import { RouteMetadata, RoutePathSet } from './parsed-route-data.model';
import { Sport } from './sport.model';

export const DEFAULT_SIMPLIFICATION_TOLERANCE_METERS = 15;
export const DEFAULT_ROUTE_IMPORT_BATCH_SIZE = 25;

export type RouteImportStatus = 'loaded' | 'skipped-sport' | 'no-gps' | 'decode-error' | 'read-error';

export interface ImportableFitFile {
  file: File;
  fileName: string;
  fileSize: number;
  lastModified: number;
}

export interface RouteImportRequest {
  files: ImportableFitFile[];
  activities: Sport[];
  simplificationToleranceMeters: number;
  batchSize: number;
}

export interface ImportedRoutePayload {
  fileName: string;
  fileSize: number;
  lastModified: number;
  metadata?: RouteMetadata;
  path: google.maps.LatLngLiteral[];
  pathSet: RoutePathSet;
  sourcePointCount: number;
  mappedPointCount: number;
}

export interface RouteImportResult {
  status: RouteImportStatus;
  fileName: string;
  route?: ImportedRoutePayload;
  errorMessage?: string;
}

export type RouteImportWorkerMessage =
  | { type: 'batch'; processed: number; results: RouteImportResult[] }
  | { type: 'progress'; processed: number }
  | { type: 'complete'; processed: number }
  | { type: 'error'; errorMessage: string };
