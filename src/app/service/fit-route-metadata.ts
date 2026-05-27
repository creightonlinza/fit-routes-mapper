import { RouteMetadata } from '../model/parsed-route-data.model';
import { RecordMessage } from '../model/record-message.model';

export function buildRouteMetadata(message: RecordMessage): RouteMetadata {
  const totalDistance = finiteValue(message.totalDistance);
  const totalTimerTime = finiteValue(message.totalTimerTime);

  return {
    sport: message.sport,
    startTime: message.startTime,
    totalElapsedTime: finiteValue(message.totalElapsedTime),
    totalTimerTime,
    totalDistance,
    totalAscent: finiteValue(message.totalAscent),
    totalDescent: finiteValue(message.totalDescent),
    totalCalories: finiteValue(message.totalCalories),
    avgHeartRate: finiteValue(message.avgHeartRate),
    maxHeartRate: finiteValue(message.maxHeartRate),
    maxSpeed: firstFinite(message.enhancedMaxSpeed, message.maxSpeed),
    avgSpeed: firstFinite(averageSpeed(totalDistance, totalTimerTime), message.enhancedAvgSpeed, message.avgSpeed),
  };
}

export function finalizeRouteMetadata(metadata: RouteMetadata | undefined, recordSpeeds: number[]): RouteMetadata | undefined {
  if (!metadata) {
    return;
  }

  return {
    ...metadata,
    maxSpeed: firstFinite(metadata.maxSpeed, maxFinite(recordSpeeds)),
    avgSpeed: firstFinite(averageSpeed(metadata.totalDistance, metadata.totalTimerTime), metadata.avgSpeed),
  };
}

export function recordSpeed(message: RecordMessage): number | undefined {
  return firstFinite(message.enhancedSpeed, message.speed);
}

function averageSpeed(distanceMeters: number | undefined, timerSeconds: number | undefined): number | undefined {
  if (!isFiniteNumber(distanceMeters) || !isFiniteNumber(timerSeconds) || timerSeconds <= 0) {
    return;
  }

  return distanceMeters / timerSeconds;
}

function maxFinite(values: number[]): number | undefined {
  let max: number | undefined;

  for (const value of values) {
    if (!isFiniteNumber(value)) {
      continue;
    }

    max = max === undefined ? value : Math.max(max, value);
  }

  return max;
}

function firstFinite(...values: (number | null | undefined)[]): number | undefined {
  return values.find(isFiniteNumber);
}

function finiteValue(value: number | null | undefined): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
