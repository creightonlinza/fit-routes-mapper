import { Sport } from './sport.model';

export interface RouteMetadata {
  sport: Sport;
  startTime: Date;
  totalTimerTime: number;
  totalDistance: number;
  totalCalories: number;
  maxSpeed: number;
  avgSpeed: number;
}

export type RoutePathDetail = 'overview' | 'standard' | 'detail';

export type RoutePathSet = Record<RoutePathDetail, google.maps.LatLngLiteral[]>;

export interface ParsedRouteData {
  id: string;
  fileName: string;
  fileSize: number;
  lastModified: number;
  sourcePointCount: number;
  mappedPointCount: number;
  visible: boolean;
  selected: boolean;
  hovered: boolean;
  baseStrokeColor: string;
  pathSet?: RoutePathSet;
  exportPath?: google.maps.LatLngLiteral[];
  polylineOptions: google.maps.PolylineOptions;
  metadata?: RouteMetadata;
}

export type FitParseStatus = 'loaded' | 'skipped-sport' | 'no-gps' | 'decode-error' | 'read-error';

export interface FitParseResult {
  status: FitParseStatus;
  fileName: string;
  routeData?: ParsedRouteData;
  errorMessage?: string;
}
