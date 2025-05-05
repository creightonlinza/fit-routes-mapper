import { Injectable } from '@angular/core';
import { Decoder, Stream, Profile } from '@garmin/fitsdk';
import { ParsedRouteData } from '../model/parsed-route-data.model';
import { RecordMessage } from '../model/record-message.model';
import { Sport } from '../model/sport.model';

@Injectable({ providedIn: 'root' })
export class FitParserService {
  async parseFitFile(
    file: File,
    activities: Sport[],
    routeData: ParsedRouteData
  ): Promise<ParsedRouteData | undefined> {
    try {
      const buffer = await this.readFileAsArrayBuffer(file);
      const streamFromFileSync = Stream.fromArrayBuffer(buffer);
      const decoder = new Decoder(streamFromFileSync);
      const coords = new Map<Object, [number, number]>();
      let includeActivity: boolean | undefined = undefined;

      const onMesg = (messageNumber: string | number, message: RecordMessage) => {
        if (Profile.types.mesgNum[messageNumber] === 'session') {
          includeActivity = Object.values(activities).includes(message.sport);
          // TODO: convert values
          routeData.metadata = {
            sport: message.sport,
            startTime: message.startTime,
            totalTimerTime: message.totalTimerTime,
            totalDistance: message.totalDistance,
            totalCalories: message.totalCalories,
            maxSpeed: message.maxSpeed,
            avgSpeed: message.avgSpeed,
          };
        }

        if (Profile.types.mesgNum[messageNumber] === 'record') {
          coords.set(message.timestamp, [message.positionLat / 11930465, message.positionLong / 11930465]);
        }
      };

      decoder.read({ mesgListener: onMesg });

      routeData.polylineOptions.path = [] as google.maps.LatLngLiteral[];
      coords.forEach((coord: [number, number]) => {
        if (includeActivity && this.isValidCoord(coord)) {
          routeData.polylineOptions?.path?.push(new google.maps.LatLng(coord[0], coord[1]));
        }
      });

      return routeData;
    } catch (error) {
      console.error('Failed to parse .fit file', error);
      return;
    }
  }

  private async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader result is not an ArrayBuffer.'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Error reading file.'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  private isValidCoord(coord: number[]): coord is [number, number] {
    return (
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1])
    );
  }
}
