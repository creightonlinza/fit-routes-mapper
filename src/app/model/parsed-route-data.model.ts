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

export interface ParsedRouteData {
  id: string;
  fileName: string;
  fileSize: number;
  lastModified: number;
  visible: boolean;
  selected: boolean;
  hovered: boolean;
  baseStrokeColor: string;
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
