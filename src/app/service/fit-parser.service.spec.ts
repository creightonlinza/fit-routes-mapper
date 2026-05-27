import { TestBed } from '@angular/core/testing';
import { ParsedRouteData } from '../model/parsed-route-data.model';
import { Sport } from '../model/sport.model';
import { FitParserService } from './fit-parser.service';

const FIT_DEGREES_TO_SEMICIRCLES = 2 ** 31 / 180;

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

function buildRouteData(): ParsedRouteData {
  return {
    id: 'route-1',
    fileName: 'activity.fit',
    fileSize: 1,
    lastModified: 1,
    sourcePointCount: 0,
    mappedPointCount: 0,
    visible: true,
    selected: false,
    hovered: false,
    baseStrokeColor: '#000000',
    polylineOptions: { path: [] },
  };
}

function mockFitSdk(service: FitParserService, messages: [string, object][], errors: string[] = []): void {
  class Decoder {
    private readonly stream: unknown;

    constructor(stream: unknown) {
      this.stream = stream;
    }

    read(options: { mesgListener: (messageNumber: string, message: object) => void }): { errors: string[] } {
      void this.stream;
      messages.forEach(([messageNumber, message]) => options.mesgListener(messageNumber, message));
      return { errors };
    }
  }

  spyOn(service as unknown as { loadFitSdk: () => Promise<unknown> }, 'loadFitSdk').and.resolveTo({
    Decoder,
    Stream: {
      fromArrayBuffer: () => ({}),
    },
    Profile: {
      types: {
        mesgNum: {
          session: 'session',
          record: 'record',
        },
      },
    },
  });
}

describe('FitParserService', () => {
  let service: FitParserService;

  beforeEach(() => {
    (globalThis as typeof globalThis & { google: typeof google }).google = {
      maps: {
        LatLng: FakeLatLng,
        MVCArray: FakeMVCArray,
      },
    } as unknown as typeof google;

    TestBed.configureTestingModule({});
    service = TestBed.inject(FitParserService);
  });

  it('should ignore null FIT coordinate fields', () => {
    expect(service['toLatLng'](null, 0)).toBeUndefined();
    expect(service['toLatLng'](0, null)).toBeUndefined();
  });

  it('should ignore coordinates outside valid map ranges', () => {
    expect(service['toLatLng'](91 * FIT_DEGREES_TO_SEMICIRCLES, 0)).toBeUndefined();
    expect(service['toLatLng'](0, 181 * FIT_DEGREES_TO_SEMICIRCLES)).toBeUndefined();
  });

  it('should convert valid FIT semicircle coordinates to degrees with the exact scale', () => {
    expect(service['toLatLng'](45 * FIT_DEGREES_TO_SEMICIRCLES, -75 * FIT_DEGREES_TO_SEMICIRCLES)).toEqual({
      lat: 45,
      lng: -75,
    });
  });

  it('should return loaded route data when the sport and coordinates match', async () => {
    mockFitSdk(service, [
      ['session', { sport: Sport.Running, totalDistance: 1000 }],
      [
        'record',
        {
          positionLat: 45 * FIT_DEGREES_TO_SEMICIRCLES,
          positionLong: -75 * FIT_DEGREES_TO_SEMICIRCLES,
        },
      ],
    ]);

    const result = await service.parseFitFile(new File([new ArrayBuffer(1)], 'run.fit'), [Sport.Running], buildRouteData());

    expect(result.status).toBe('loaded');
    expect(result.routeData?.metadata?.sport).toBe(Sport.Running);
    expect(result.routeData?.polylineOptions.path).toEqual([{ lat: 45, lng: -75 }]);
    expect(result.routeData?.sourcePointCount).toBe(1);
    expect(result.routeData?.mappedPointCount).toBe(1);
  });

  it('should normalize route timing and speed metadata from session and record messages', async () => {
    mockFitSdk(service, [
      [
        'session',
        {
          sport: Sport.Running,
          totalElapsedTime: 650,
          totalTimerTime: 500,
          totalDistance: 1000,
          totalAscent: 42,
          totalDescent: 21,
          avgHeartRate: 145,
          maxHeartRate: 172,
          avgSpeed: 1,
          enhancedAvgSpeed: 1.5,
          maxSpeed: 3,
          enhancedMaxSpeed: 3.5,
        },
      ],
      [
        'record',
        {
          positionLat: 45 * FIT_DEGREES_TO_SEMICIRCLES,
          positionLong: -75 * FIT_DEGREES_TO_SEMICIRCLES,
          speed: 4,
          enhancedSpeed: 4.5,
        },
      ],
      [
        'record',
        {
          positionLat: 45.1 * FIT_DEGREES_TO_SEMICIRCLES,
          positionLong: -75.1 * FIT_DEGREES_TO_SEMICIRCLES,
          speed: 5,
        },
      ],
    ]);

    const result = await service.parseFitFile(new File([new ArrayBuffer(1)], 'run.fit'), [Sport.Running], buildRouteData());

    expect(result.status).toBe('loaded');
    expect(result.routeData?.metadata?.totalElapsedTime).toBe(650);
    expect(result.routeData?.metadata?.totalTimerTime).toBe(500);
    expect(result.routeData?.metadata?.totalAscent).toBe(42);
    expect(result.routeData?.metadata?.totalDescent).toBe(21);
    expect(result.routeData?.metadata?.avgHeartRate).toBe(145);
    expect(result.routeData?.metadata?.maxHeartRate).toBe(172);
    expect(result.routeData?.metadata?.avgSpeed).toBe(2);
    expect(result.routeData?.metadata?.maxSpeed).toBe(5);
  });

  it('should return skipped-sport when the session sport is not selected', async () => {
    mockFitSdk(service, [['session', { sport: Sport.Cycling }]]);

    const result = await service.parseFitFile(new File([new ArrayBuffer(1)], 'ride.fit'), [Sport.Running], buildRouteData());

    expect(result.status).toBe('skipped-sport');
  });

  it('should return no-gps when a matching activity has no route coordinates', async () => {
    mockFitSdk(service, [['session', { sport: Sport.Running }]]);

    const result = await service.parseFitFile(new File([new ArrayBuffer(1)], 'run.fit'), [Sport.Running], buildRouteData());

    expect(result.status).toBe('no-gps');
  });

  it('should return decode-error when the decoder reports errors', async () => {
    mockFitSdk(service, [['session', { sport: Sport.Running }]], ['bad file']);
    spyOn(console, 'error');

    const result = await service.parseFitFile(new File([new ArrayBuffer(1)], 'bad.fit'), [Sport.Running], buildRouteData());

    expect(result.status).toBe('decode-error');
    expect(result.errorMessage).toContain('FIT decoder reported');
  });

  it('should return read-error when FileReader fails', async () => {
    spyOn(service as unknown as { readFileAsArrayBuffer: (file: File) => Promise<ArrayBuffer> }, 'readFileAsArrayBuffer').and.rejectWith(
      new Error('Cannot read')
    );

    const result = await service.parseFitFile(new File([], 'bad.fit'), [Sport.Running], buildRouteData());

    expect(result.status).toBe('read-error');
    expect(result.errorMessage).toBe('Cannot read');
  });
});
