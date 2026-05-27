import { Injectable } from '@angular/core';
import { ParsedRouteData } from '../model/parsed-route-data.model';

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

interface GeoJsonFeature {
  type: 'Feature';
  properties: Record<string, string | number | null>;
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
}

@Injectable({ providedIn: 'root' })
export class RouteExportService {
  buildGeoJson(routes: ParsedRouteData[]): string {
    const featureCollection: GeoJsonFeatureCollection = {
      type: 'FeatureCollection',
      features: routes.filter(route => route.visible).map(route => this.toGeoJsonFeature(route)),
    };

    return JSON.stringify(featureCollection, null, 2);
  }

  buildCsv(routes: ParsedRouteData[]): string {
    const headers = [
      'fileName',
      'sport',
      'startTime',
      'elapsedTimeSeconds',
      'distanceMeters',
      'calories',
      'maxSpeedMetersPerSecond',
      'averageSpeedMetersPerSecond',
      'sourcePointCount',
      'mappedPointCount',
      'pointCount',
    ];

    const rows = routes.filter(route => route.visible).map(route => [
      route.fileName,
      route.metadata?.sport ?? '',
      this.toIsoDate(route.metadata?.startTime),
      route.metadata?.totalTimerTime ?? '',
      route.metadata?.totalDistance ?? '',
      route.metadata?.totalCalories ?? '',
      route.metadata?.maxSpeed ?? '',
      route.metadata?.avgSpeed ?? '',
      route.sourcePointCount,
      route.mappedPointCount,
      this.pathPoints(route).length,
    ]);

    return [headers, ...rows].map(row => row.map(value => this.escapeCsvValue(value)).join(',')).join('\n');
  }

  private toGeoJsonFeature(route: ParsedRouteData): GeoJsonFeature {
    return {
      type: 'Feature',
      properties: {
        id: route.id,
        fileName: route.fileName,
        fileSize: route.fileSize,
        lastModified: route.lastModified,
        sport: route.metadata?.sport ?? null,
        startTime: this.toIsoDate(route.metadata?.startTime),
        elapsedTimeSeconds: route.metadata?.totalTimerTime ?? null,
        distanceMeters: route.metadata?.totalDistance ?? null,
        calories: route.metadata?.totalCalories ?? null,
        maxSpeedMetersPerSecond: route.metadata?.maxSpeed ?? null,
        averageSpeedMetersPerSecond: route.metadata?.avgSpeed ?? null,
        sourcePointCount: route.sourcePointCount,
        mappedPointCount: route.mappedPointCount,
        pointCount: this.pathPoints(route).length,
      },
      geometry: {
        type: 'LineString',
        coordinates: this.pathPoints(route).map(point => [point.lng, point.lat]),
      },
    };
  }

  private pathPoints(route: ParsedRouteData): google.maps.LatLngLiteral[] {
    const path = route.exportPath ?? route.polylineOptions.path;
    if (!path) {
      return [];
    }

    const points = path instanceof google.maps.MVCArray ? path.getArray() : path;

    return points.map(point => this.toLatLngLiteral(point)).filter(point => point !== undefined);
  }

  private toLatLngLiteral(
    point: google.maps.LatLng | google.maps.LatLngLiteral
  ): google.maps.LatLngLiteral | undefined {
    if (point instanceof google.maps.LatLng) {
      return point.toJSON();
    }

    if (typeof point.lat === 'number' && typeof point.lng === 'number') {
      return point;
    }

    return;
  }

  private toIsoDate(date: Date | undefined): string | null {
    return date ? new Date(date).toISOString() : null;
  }

  private escapeCsvValue(value: string | number | null): string {
    const stringValue = value === null ? '' : String(value);

    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }
}
