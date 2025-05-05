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
  polylineOptions: google.maps.PolylineOptions;
  metadata?: RouteMetadata;
}
