import { TestBed } from '@angular/core/testing';
import { ParsedRouteData } from '../model/parsed-route-data.model';
import { Sport } from '../model/sport.model';
import { RouteExportService } from './route-export.service';

class FakeLatLng {
  constructor(
    private readonly lat: number,
    private readonly lng: number
  ) {}

  toJSON(): google.maps.LatLngLiteral {
    return { lat: this.lat, lng: this.lng };
  }
}

class FakeMVCArray<T> {
  constructor(private readonly values: T[]) {}

  getArray(): T[] {
    return this.values;
  }
}

function buildRoute(overrides: Partial<ParsedRouteData> = {}): ParsedRouteData {
  return {
    id: 'route-1',
    fileName: 'activity.fit',
    fileSize: 123,
    lastModified: 456,
    sourcePointCount: 2,
    mappedPointCount: 2,
    visible: true,
    selected: false,
    hovered: false,
    baseStrokeColor: '#000000',
    metadata: {
      sport: Sport.Running,
      startTime: new Date('2025-01-01T12:00:00Z'),
      totalElapsedTime: 3700,
      totalTimerTime: 3600,
      totalDistance: 10000,
      totalAscent: 120,
      totalDescent: 90,
      totalCalories: 500,
      avgHeartRate: 142,
      maxHeartRate: 175,
      maxSpeed: 5,
      avgSpeed: 3,
    },
    polylineOptions: {
      path: [
        { lat: 45, lng: -75 },
        { lat: 46, lng: -76 },
      ],
    },
    ...overrides,
  };
}

describe('RouteExportService', () => {
  let service: RouteExportService;

  beforeEach(() => {
    (globalThis as typeof globalThis & { google: typeof google }).google = {
      maps: {
        LatLng: FakeLatLng,
        MVCArray: FakeMVCArray,
      },
    } as unknown as typeof google;

    TestBed.configureTestingModule({});
    service = TestBed.inject(RouteExportService);
  });

  it('should export loaded routes as GeoJSON features', () => {
    const geoJson = JSON.parse(service.buildGeoJson([buildRoute(), buildRoute({ id: 'second' })]));

    expect(geoJson.type).toBe('FeatureCollection');
    expect(geoJson.features.length).toBe(2);
    expect(geoJson.features[0].properties.fileName).toBe('activity.fit');
    expect(geoJson.features[0].properties.sourcePointCount).toBe(2);
    expect(geoJson.features[0].properties.mappedPointCount).toBe(2);
    expect(geoJson.features[0].properties.pointCount).toBe(2);
    expect(geoJson.features[0].geometry.coordinates).toEqual([
      [-75, 45],
      [-76, 46],
    ]);
  });

  it('should export loaded routes as CSV rows', () => {
    const csv = service.buildCsv([buildRoute(), buildRoute({ id: 'second' })]);

    expect(csv).toContain('fileName,sport,startTime,elapsedTimeSeconds');
    expect(csv).toContain('activity.fit,running,2025-01-01T12:00:00.000Z,3700,3600,10000,120,90,500,142,175,5,3,2,2,2');
    expect(csv.split('\n').length).toBe(3);
  });

  it('should escape CSV values and use metadata fallbacks', () => {
    const csv = service.buildCsv([
      buildRoute({
        fileName: 'quoted, "route".fit',
        metadata: undefined,
        polylineOptions: { path: [] },
      }),
    ]);

    expect(csv).toContain('"quoted, ""route"".fit",,,,,,,,,,,,,2,2,0');
  });

  it('should support MVCArray path exports', () => {
    const geoJson = JSON.parse(
      service.buildGeoJson([
        buildRoute({
          polylineOptions: {
            path: new google.maps.MVCArray([new google.maps.LatLng(1, 2)]),
          },
        }),
      ])
    );

    expect(geoJson.features[0].geometry.coordinates).toEqual([[2, 1]]);
  });

  it('should prefer export paths over current map detail paths', () => {
    const geoJson = JSON.parse(
      service.buildGeoJson([
        buildRoute({
          exportPath: [
            { lat: 10, lng: 20 },
            { lat: 11, lng: 21 },
          ],
          polylineOptions: {
            path: [{ lat: 1, lng: 2 }],
          },
        }),
      ])
    );

    expect(geoJson.features[0].geometry.coordinates).toEqual([
      [20, 10],
      [21, 11],
    ]);
  });

  it('should export empty collections when no routes are loaded', () => {
    const geoJson = JSON.parse(service.buildGeoJson([]));
    const csv = service.buildCsv([]);

    expect(geoJson.features).toEqual([]);
    expect(csv.split('\n').length).toBe(1);
  });
});
