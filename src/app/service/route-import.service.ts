import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  DEFAULT_ROUTE_IMPORT_BATCH_SIZE,
  DEFAULT_SIMPLIFICATION_TOLERANCE_METERS,
  ImportableFitFile,
  RouteImportRequest,
  RouteImportResult,
  RouteImportWorkerMessage,
} from '../model/route-import.model';
import { Sport } from '../model/sport.model';

export interface RouteImportOptions {
  files: File[];
  activities: Sport[];
  simplificationToleranceMeters?: number;
  batchSize?: number;
}

export interface RouteImportHandlers {
  onBatch: (results: RouteImportResult[]) => void;
  onProgress: (processed: number) => void;
}

export const ROUTE_IMPORT_WORKER_FACTORY = new InjectionToken<() => Worker>('ROUTE_IMPORT_WORKER_FACTORY', {
  providedIn: 'root',
  factory: () => () => {
    if (typeof Worker === 'undefined') {
      throw new Error('This browser does not support Web Workers, which are required for large imports.');
    }

    return new Worker(new URL('../worker/route-import.worker', import.meta.url), { type: 'module' });
  },
});

@Injectable({ providedIn: 'root' })
export class RouteImportService {
  private workerFactory = inject(ROUTE_IMPORT_WORKER_FACTORY);

  importFiles(options: RouteImportOptions, handlers: RouteImportHandlers): Promise<void> {
    let worker: Worker;

    try {
      worker = this.workerFactory();
    } catch (error) {
      return Promise.reject(error);
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const finish = (callback: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        worker.terminate();
        callback();
      };

      worker.onmessage = (event: MessageEvent<RouteImportWorkerMessage>) => {
        const message = event.data;

        try {
          switch (message.type) {
            case 'batch':
              handlers.onBatch(message.results);
              handlers.onProgress(message.processed);
              break;
            case 'progress':
              handlers.onProgress(message.processed);
              break;
            case 'complete':
              handlers.onProgress(message.processed);
              finish(resolve);
              break;
            case 'error':
              finish(() => reject(new Error(message.errorMessage)));
              break;
          }
        } catch (error) {
          finish(() => reject(error));
        }
      };

      worker.onerror = event => {
        finish(() => reject(new Error(event.message || 'Route import worker failed.')));
      };

      const request: RouteImportRequest = {
        files: this.toImportableFiles(options.files),
        activities: options.activities,
        simplificationToleranceMeters: options.simplificationToleranceMeters ?? DEFAULT_SIMPLIFICATION_TOLERANCE_METERS,
        batchSize: options.batchSize ?? DEFAULT_ROUTE_IMPORT_BATCH_SIZE,
      };

      worker.postMessage(request);
    });
  }

  private toImportableFiles(files: File[]): ImportableFitFile[] {
    return files.map(file => ({
      file,
      fileName: file.name,
      fileSize: file.size,
      lastModified: file.lastModified,
    }));
  }
}
