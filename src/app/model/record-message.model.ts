import { Sport } from './sport.model';

export interface RecordMessage {
  startTime?: any;
  totalTimerTime?: any;
  totalDistance?: any;
  totalCalories?: any;
  maxSpeed?: any;
  avgSpeed?: any;
  sport: Sport;
  timestamp: Object;
  positionLat: number;
  positionLong: number;
}
