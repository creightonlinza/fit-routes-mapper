import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { FitParserService } from './service/fit-parser.service';
import { Sport } from './model/sport.model';
import { RouteMetadata } from './model/parsed-route-data.model';

class FakeLatLng {
  constructor(
    private readonly lat: number,
    private readonly lng: number
  ) {}

  toJSON(): google.maps.LatLngLiteral {
    return { lat: this.lat, lng: this.lng };
  }
}

class FakeLatLngBounds {
  private readonly points: google.maps.LatLngLiteral[] = [];

  extend(point: google.maps.LatLngLiteral): void {
    this.points.push(point);
  }

  getCenter(): google.maps.LatLng {
    const center = this.points.reduce(
      (total, point) => ({
        lat: total.lat + point.lat / this.points.length,
        lng: total.lng + point.lng / this.points.length,
      }),
      { lat: 0, lng: 0 }
    );

    return new FakeLatLng(center.lat, center.lng) as unknown as google.maps.LatLng;
  }
}

class FakeMVCArray<T> {
  constructor(private readonly values: T[]) {}

  getArray(): T[] {
    return this.values;
  }
}

describe('AppComponent', () => {
  beforeEach(async () => {
    (globalThis as typeof globalThis & { google: typeof google }).google = {
      maps: {
        LatLng: FakeLatLng,
        LatLngBounds: FakeLatLngBounds,
        MVCArray: FakeMVCArray,
      },
    } as unknown as typeof google;

    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should skip parsing when no activities are selected', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitParserService = TestBed.inject(FitParserService);
    const parseFitFileSpy = spyOn(fitParserService, 'parseFitFile');

    app.inputFiles = [new File([], 'activity.fit')];
    app.activities = Object.fromEntries(app.sports.map(sport => [sport, false]));

    await app.loadFiles();

    expect(app.errorMessage).toBe('Select at least one activity type to load');
    expect(parseFitFileSpy).not.toHaveBeenCalled();
  });

  it('should preserve the default map center when loaded routes have no points', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const defaultCenter = app.mapCenter;

    app.parsedRouteData = [{ polylineOptions: { path: [] } }];

    app.setMapViewport();

    expect(app.mapCenter).toEqual(defaultCenter);
  });

  it('should fit the map to route points from array paths', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitBounds = jasmine.createSpy('fitBounds');
    app.map = { googleMap: { fitBounds } } as unknown as AppComponent['map'];

    app.parsedRouteData = [
      {
        polylineOptions: {
          path: [
            { lat: 10, lng: 20 },
            { lat: 20, lng: 40 },
          ],
        },
      },
    ];

    app.setMapViewport();

    expect(app.mapCenter).toEqual({ lat: 15, lng: 30 });
    expect(fitBounds).toHaveBeenCalled();
  });

  it('should fit the map to route points from MVCArray paths', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitBounds = jasmine.createSpy('fitBounds');
    app.map = { googleMap: { fitBounds } } as unknown as AppComponent['map'];

    app.parsedRouteData = [
      {
        polylineOptions: {
          path: new google.maps.MVCArray([
            new google.maps.LatLng(30, -100),
            new google.maps.LatLng(40, -80),
          ]),
        },
      },
    ];

    app.setMapViewport();

    expect(app.mapCenter).toEqual({ lat: 35, lng: -90 });
    expect(fitBounds).toHaveBeenCalled();
  });

  it('should format route details in imperial units by default', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const details = Object.fromEntries(
      app.routeDetailItems({
        sport: Sport.Running,
        startTime: new Date('2025-01-01T12:00:00Z'),
        totalTimerTime: 3661,
        totalDistance: 1609.344,
        totalCalories: 425.4,
        maxSpeed: 4,
        avgSpeed: 2,
      }).map(item => [item.label, item.value])
    );

    expect(details['Sport']).toBe('Running');
    expect(details['Elapsed Time']).toBe('1h 01m 01s');
    expect(details['Distance']).toBe('1.00 mi');
    expect(details['Calories']).toBe('425 kcal');
    expect(details['Max Speed']).toBe('8.9 mph');
    expect(details['Average Speed']).toBe('4.5 mph');
  });

  it('should format route details in metric units', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.unitSystem = 'metric';

    const details = Object.fromEntries(
      app.routeDetailItems({
        totalDistance: 1609.344,
        maxSpeed: 4,
        avgSpeed: 2,
      }).map(item => [item.label, item.value])
    );

    expect(details['Distance']).toBe('1.61 km');
    expect(details['Max Speed']).toBe('14.4 km/h');
    expect(details['Average Speed']).toBe('7.2 km/h');
    expect(details['Sport']).toBe('N/A');
  });

  it('should total loaded route distances in imperial units by default', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.parsedRouteData = [
      { polylineOptions: {}, metadata: { totalDistance: 1609.344 } as RouteMetadata },
      { polylineOptions: {}, metadata: { totalDistance: 804.672 } as RouteMetadata },
    ];

    expect(app.hasLoadedRoutes()).toBeTrue();
    expect(app.totalDistanceLabel()).toBe('1.50 mi');
  });

  it('should total loaded route distances in metric units', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.unitSystem = 'metric';

    app.parsedRouteData = [
      { polylineOptions: {}, metadata: { totalDistance: 1000 } as RouteMetadata },
      { polylineOptions: {}, metadata: { totalDistance: 1500 } as RouteMetadata },
    ];

    expect(app.totalDistanceLabel()).toBe('2.50 km');
  });

  it('should show no total distance when loaded routes have no distance metadata', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.parsedRouteData = [{ polylineOptions: {} }];

    expect(app.totalDistanceLabel()).toBe('N/A');
  });
});
