const EARTH_RADIUS_METERS = 6371008.8;

interface ProjectedPoint {
  point: google.maps.LatLngLiteral;
  x: number;
  y: number;
}

export function simplifyPath(
  points: google.maps.LatLngLiteral[],
  toleranceMeters: number
): google.maps.LatLngLiteral[] {
  if (points.length <= 2 || toleranceMeters <= 0) {
    return [...points];
  }

  const projectedPoints = projectPoints(points);
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  simplifyRange(projectedPoints, 0, points.length - 1, toleranceMeters * toleranceMeters, keep);

  return points.filter((_, index) => keep[index]);
}

function projectPoints(points: google.maps.LatLngLiteral[]): ProjectedPoint[] {
  const originLatRadians = toRadians(points[0].lat);
  const cosOriginLat = Math.cos(originLatRadians);

  return points.map(point => ({
    point,
    x: EARTH_RADIUS_METERS * toRadians(point.lng) * cosOriginLat,
    y: EARTH_RADIUS_METERS * toRadians(point.lat),
  }));
}

function simplifyRange(
  points: ProjectedPoint[],
  firstIndex: number,
  lastIndex: number,
  toleranceSquared: number,
  keep: boolean[]
): void {
  if (lastIndex <= firstIndex + 1) {
    return;
  }

  let maxDistanceSquared = 0;
  let maxIndex = firstIndex;

  for (let index = firstIndex + 1; index < lastIndex; index += 1) {
    const distanceSquared = perpendicularDistanceSquared(points[index], points[firstIndex], points[lastIndex]);
    if (distanceSquared > maxDistanceSquared) {
      maxDistanceSquared = distanceSquared;
      maxIndex = index;
    }
  }

  if (maxDistanceSquared <= toleranceSquared) {
    return;
  }

  keep[maxIndex] = true;
  simplifyRange(points, firstIndex, maxIndex, toleranceSquared, keep);
  simplifyRange(points, maxIndex, lastIndex, toleranceSquared, keep);
}

function perpendicularDistanceSquared(point: ProjectedPoint, start: ProjectedPoint, end: ProjectedPoint): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  if (deltaX === 0 && deltaY === 0) {
    return squaredDistance(point, start);
  }

  const projection = ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / (deltaX * deltaX + deltaY * deltaY);
  const clampedProjection = Math.max(0, Math.min(1, projection));
  const projectedX = start.x + clampedProjection * deltaX;
  const projectedY = start.y + clampedProjection * deltaY;
  const distanceX = point.x - projectedX;
  const distanceY = point.y - projectedY;

  return distanceX * distanceX + distanceY * distanceY;
}

function squaredDistance(first: ProjectedPoint, second: ProjectedPoint): number {
  const deltaX = first.x - second.x;
  const deltaY = first.y - second.y;

  return deltaX * deltaX + deltaY * deltaY;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
