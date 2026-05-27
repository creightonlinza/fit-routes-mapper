import { Sport } from './sport.model';

export interface RecordMessage {
  startTime?: Date;
  totalElapsedTime?: number;
  totalTimerTime?: number;
  totalDistance?: number;
  totalAscent?: number;
  totalDescent?: number;
  totalCalories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  maxSpeed?: number;
  avgSpeed?: number;
  enhancedMaxSpeed?: number;
  enhancedAvgSpeed?: number;
  sport?: Sport;
  timestamp?: Date | null;
  positionLat?: number | null;
  positionLong?: number | null;
  speed?: number | null;
  enhancedSpeed?: number | null;
}
