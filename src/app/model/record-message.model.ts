import { Sport } from './sport.model';

export interface RecordMessage {
  startTime: Date;
  totalTimerTime: number;
  totalDistance: number;
  totalCalories: number;
  maxSpeed: number;
  avgSpeed: number;
  sport: Sport;
  timestamp?: object | null;
  positionLat?: number | null;
  positionLong?: number | null;
}
