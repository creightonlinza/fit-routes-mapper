import { Injectable } from '@angular/core';
import { FitParseResult, ParsedRouteData } from '../model/parsed-route-data.model';
import { RecordMessage } from '../model/record-message.model';
import { Sport } from '../model/sport.model';

const FIT_SEMICIRCLES_SCALE = 180 / 2 ** 31;

@Injectable({ providedIn: 'root' })
export class FitParserService {
  async parseFitFile(
    file: File,
    activities: Sport[],
    routeData: ParsedRouteData
  ): Promise<FitParseResult> {
    let buffer: ArrayBuffer;

    try {
      buffer = await this.readFileAsArrayBuffer(file);
    } catch (error) {
      return {
        status: 'read-error',
        fileName: file.name,
        errorMessage: this.errorMessage(error),
      };
    }

    try {
      const { Decoder, Stream, Profile } = await this.loadFitSdk();
      const streamFromFileSync = Stream.fromArrayBuffer(buffer);
      const decoder = new Decoder(streamFromFileSync);
      const coords: [number, number][] = [];
      let includeActivity: boolean | undefined = undefined;

      const onMesg = (messageNumber: string | number, message: RecordMessage) => {
        if (Profile.types.mesgNum[messageNumber] === 'session') {
          includeActivity = activities.includes(message.sport);
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
          const coord = this.toLatLng(message.positionLat, message.positionLong);
          if (coord) {
            coords.push(coord);
          }
        }
      };

      const { errors = [] } = decoder.read({ mesgListener: onMesg });
      if (errors.length > 0) {
        throw new Error(`FIT decoder reported ${errors.length} error(s).`);
      }

      if (!includeActivity) {
        return { status: 'skipped-sport', fileName: file.name };
      }

      if (coords.length === 0) {
        return { status: 'no-gps', fileName: file.name };
      }

      routeData.polylineOptions.path = coords.map(([lat, lng]) => ({ lat, lng }));

      return { status: 'loaded', fileName: file.name, routeData };
    } catch (error) {
      console.error('Failed to parse .fit file', error);
      return {
        status: 'decode-error',
        fileName: file.name,
        errorMessage: this.errorMessage(error),
      };
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

  private async loadFitSdk(): Promise<typeof import('@garmin/fitsdk')> {
    return import('@garmin/fitsdk');
  }

  private toLatLng(positionLat: number | null | undefined, positionLong: number | null | undefined): [number, number] | undefined {
    if (!this.isFiniteNumber(positionLat) || !this.isFiniteNumber(positionLong)) {
      return;
    }

    const lat = positionLat * FIT_SEMICIRCLES_SCALE;
    const lng = positionLong * FIT_SEMICIRCLES_SCALE;

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return;
    }

    return [lat, lng];
  }

  private isFiniteNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown FIT parsing error.';
  }
}
