/// <reference lib="webworker" />

import { RecordMessage } from '../model/record-message.model';
import { RoutePathSet } from '../model/parsed-route-data.model';
import {
  ImportedRoutePayload,
  RouteImportRequest,
  RouteImportResult,
  RouteImportWorkerMessage,
} from '../model/route-import.model';
import { Sport } from '../model/sport.model';
import { simplifyPath } from '../service/route-simplifier';

const FIT_SEMICIRCLES_SCALE = 180 / 2 ** 31;

type FitSdk = typeof import('@garmin/fitsdk');

let fitSdkPromise: Promise<FitSdk> | undefined;

addEventListener('message', event => {
  void importRoutes(event.data as RouteImportRequest);
});

async function importRoutes(request: RouteImportRequest): Promise<void> {
  try {
    const batchSize = Math.max(1, request.batchSize);
    const batch: RouteImportResult[] = [];
    let processed = 0;

    for (const file of request.files) {
      const result = await parseFitFile(file, request.activities, request.simplificationToleranceMeters);
      batch.push(result);
      processed += 1;

      if (batch.length >= batchSize) {
        postWorkerMessage({ type: 'batch', processed, results: batch.splice(0) });
      } else if (processed % 10 === 0) {
        postWorkerMessage({ type: 'progress', processed });
      }
    }

    if (batch.length > 0) {
      postWorkerMessage({ type: 'batch', processed, results: batch });
    }

    postWorkerMessage({ type: 'complete', processed });
  } catch (error) {
    postWorkerMessage({ type: 'error', errorMessage: errorMessage(error) });
  }
}

async function parseFitFile(
  file: RouteImportRequest['files'][number],
  activities: Sport[],
  simplificationToleranceMeters: number
): Promise<RouteImportResult> {
  let buffer: ArrayBuffer;

  try {
    buffer = await file.file.arrayBuffer();
  } catch (error) {
    return {
      status: 'read-error',
      fileName: file.fileName,
      errorMessage: errorMessage(error),
    };
  }

  try {
    const { Decoder, Stream, Profile } = await loadFitSdk();
    const streamFromFileSync = Stream.fromArrayBuffer(buffer);
    const decoder = new Decoder(streamFromFileSync);
    const coords: google.maps.LatLngLiteral[] = [];
    let metadata: ImportedRoutePayload['metadata'];
    let includeActivity: boolean | undefined;

    const onMesg = (messageNumber: string | number, message: RecordMessage) => {
      if (Profile.types.mesgNum[messageNumber] === 'session') {
        includeActivity = activities.includes(message.sport);
        metadata = {
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
        const coord = toLatLng(message.positionLat, message.positionLong);
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
      return { status: 'skipped-sport', fileName: file.fileName };
    }

    if (coords.length === 0) {
      return { status: 'no-gps', fileName: file.fileName };
    }

    const pathSet = buildPathSet(coords, simplificationToleranceMeters);
    const simplifiedCoords = pathSet.standard;

    return {
      status: 'loaded',
      fileName: file.fileName,
      route: {
        fileName: file.fileName,
        fileSize: file.fileSize,
        lastModified: file.lastModified,
        metadata,
        path: simplifiedCoords,
        pathSet,
        sourcePointCount: coords.length,
        mappedPointCount: simplifiedCoords.length,
      },
    };
  } catch (error) {
    return {
      status: 'decode-error',
      fileName: file.fileName,
      errorMessage: errorMessage(error),
    };
  }
}

function loadFitSdk(): Promise<FitSdk> {
  fitSdkPromise ??= import('@garmin/fitsdk');

  return fitSdkPromise;
}

function buildPathSet(coords: google.maps.LatLngLiteral[], simplificationToleranceMeters: number): RoutePathSet {
  return {
    overview: simplifyPath(coords, simplificationToleranceMeters * 4),
    standard: simplifyPath(coords, simplificationToleranceMeters),
    detail: simplifyPath(coords, Math.max(1, simplificationToleranceMeters / 3)),
  };
}

function toLatLng(positionLat: number | null | undefined, positionLong: number | null | undefined): google.maps.LatLngLiteral | undefined {
  if (!isFiniteNumber(positionLat) || !isFiniteNumber(positionLong)) {
    return;
  }

  const lat = positionLat * FIT_SEMICIRCLES_SCALE;
  const lng = positionLong * FIT_SEMICIRCLES_SCALE;

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return;
  }

  return { lat, lng };
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function postWorkerMessage(message: RouteImportWorkerMessage): void {
  postMessage(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown FIT parsing error.';
}
