import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from './app.component';
import { RouteMetadata, ParsedRouteData } from './model/parsed-route-data.model';
import { Sport } from './model/sport.model';
import { FitParserService } from './service/fit-parser.service';

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

function buildRoute(overrides: Partial<ParsedRouteData> = {}): ParsedRouteData {
  return {
    id: 'route-1',
    fileName: 'activity.fit',
    fileSize: 100,
    lastModified: 1,
    visible: true,
    selected: false,
    hovered: false,
    baseStrokeColor: '#000000',
    polylineOptions: {
      strokeColor: '#000000',
      strokeOpacity: 0.8,
      strokeWeight: 5,
      path: [
        { lat: 10, lng: 20 },
        { lat: 20, lng: 40 },
      ],
    },
    ...overrides,
  };
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

  it('should parse .FIT files case-insensitively', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitParserService = TestBed.inject(FitParserService);
    spyOn(fitParserService, 'parseFitFile').and.callFake(async (file, activities, routeData) => {
      routeData.metadata = { totalDistance: 1000 } as RouteMetadata;
      routeData.polylineOptions.path = [{ lat: 1, lng: 2 }];
      return { status: 'loaded', fileName: file.name, routeData };
    });

    app.inputFiles = [new File([], 'UPPER.FIT')];

    await app.loadFiles();

    expect(fitParserService.parseFitFile).toHaveBeenCalled();
    expect(app.parsedRouteData.length).toBe(1);
    expect(app.parsedRouteData[0].fileName).toBe('UPPER.FIT');
  });

  it('should keep the input modal open when no matching routes are parsed', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitParserService = TestBed.inject(FitParserService);
    spyOn(fitParserService, 'parseFitFile').and.resolveTo({ status: 'skipped-sport', fileName: 'activity.fit' });

    app.inputFiles = [new File([], 'activity.fit')];

    await app.loadFiles();

    expect(app.errorMessage).toBe('No matching routes were found in the selected .fit files');
    expect(app.parsingFiles).toBeFalse();
    expect(app.hasLoadedRoutes()).toBeFalse();
    expect(app.parsingSummary.skippedSport).toBe(1);
  });

  it('should summarize loaded, skipped, error, and non-FIT import outcomes', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitParserService = TestBed.inject(FitParserService);
    spyOn(fitParserService, 'parseFitFile').and.callFake(async (file, activities, routeData) => {
      if (file.name === 'loaded.fit') {
        routeData.polylineOptions.path = [{ lat: 1, lng: 2 }];
        return { status: 'loaded', fileName: file.name, routeData };
      }
      if (file.name === 'nogps.fit') {
        return { status: 'no-gps', fileName: file.name };
      }
      return { status: 'decode-error', fileName: file.name, errorMessage: 'Bad FIT' };
    });

    app.inputFiles = [
      new File([], 'loaded.fit'),
      new File([], 'nogps.fit'),
      new File([], 'bad.fit'),
      new File([], 'notes.txt'),
    ];

    await app.loadFiles();

    expect(app.parsingSummary.loaded).toBe(1);
    expect(app.parsingSummary.noGps).toBe(1);
    expect(app.parsingSummary.decodeError).toBe(1);
    expect(app.parsingSummary.nonFit).toBe(1);
    expect(app.hasParsingSummary).toBeTrue();
  });

  it('should generate six-digit random route colors', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    spyOn(Math, 'random').and.returnValue(1 / 16777215);

    expect(app['generateRandomColor']()).toBe('#000001');
  });

  it('should preserve the default map center when loaded visible routes have no points', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const defaultCenter = app.mapCenter;

    app.parsedRouteData = [buildRoute({ polylineOptions: { path: [] } })];

    app.setMapViewport();

    expect(app.mapCenter).toEqual(defaultCenter);
  });

  it('should fit the map to route points from visible array paths', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitBounds = jasmine.createSpy('fitBounds');
    app.map = { googleMap: { fitBounds } } as unknown as AppComponent['map'];

    app.parsedRouteData = [buildRoute()];

    app.setMapViewport();

    expect(app.mapCenter).toEqual({ lat: 15, lng: 30 });
    expect(fitBounds).toHaveBeenCalled();
  });

  it('should ignore hidden routes when fitting the map and totaling distances', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitBounds = jasmine.createSpy('fitBounds');
    app.map = { googleMap: { fitBounds } } as unknown as AppComponent['map'];

    app.parsedRouteData = [
      buildRoute({
        id: 'visible',
        metadata: { totalDistance: 1000 } as RouteMetadata,
      }),
      buildRoute({
        id: 'hidden',
        visible: false,
        metadata: { totalDistance: 2000 } as RouteMetadata,
        polylineOptions: { path: [{ lat: 80, lng: 80 }] },
      }),
    ];

    app.setMapViewport();

    expect(app.mapCenter).toEqual({ lat: 15, lng: 30 });
    expect(app.totalDistanceLabel()).toBe('0.62 mi');
  });

  it('should fit the map to route points from MVCArray paths', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitBounds = jasmine.createSpy('fitBounds');
    app.map = { googleMap: { fitBounds } } as unknown as AppComponent['map'];

    app.parsedRouteData = [
      buildRoute({
        polylineOptions: {
          path: new google.maps.MVCArray([
            new google.maps.LatLng(30, -100),
            new google.maps.LatLng(40, -80),
          ]),
        },
      }),
    ];

    app.setMapViewport();

    expect(app.mapCenter).toEqual({ lat: 35, lng: -90 });
    expect(fitBounds).toHaveBeenCalled();
  });

  it('should select and highlight a route without opening the modal when requested', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const route = buildRoute({ metadata: { sport: Sport.Running } as RouteMetadata });
    app.parsedRouteData = [route];

    app.selectRoute(route, false);

    expect(app.selectedRouteId).toBe(route.id);
    expect(route.selected).toBeTrue();
    expect(route.polylineOptions.strokeOpacity).toBe(1);
    expect(route.polylineOptions.strokeWeight).toBe(8);
  });

  it('should hide and delete routes from the visible set', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const route = buildRoute();
    app.parsedRouteData = [route];

    app.toggleRouteVisibility(route);
    expect(app.hasVisibleRoutes()).toBeFalse();

    app.deleteRoute(route);
    expect(app.hasLoadedRoutes()).toBeFalse();
  });

  it('should clear route state without reloading the page', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const modalOpen = spyOn(TestBed.inject(NgbModal), 'open');
    app.parsedRouteData = [buildRoute()];
    app.hasParsingSummary = true;

    app.clearRoutes();

    expect(app.parsedRouteData).toEqual([]);
    expect(app.hasParsingSummary).toBeFalse();
    expect(modalOpen).toHaveBeenCalled();
  });

  it('should format route details in imperial units by default', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.routeDetailFileName = 'run.fit';
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

    expect(details['File']).toBe('run.fit');
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

  it('should expose export eligibility based on visible routes', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.parsedRouteData = [buildRoute({ visible: false })];
    expect(app.hasVisibleRoutes()).toBeFalse();

    app.parsedRouteData[0].visible = true;
    expect(app.hasVisibleRoutes()).toBeTrue();
  });
});
