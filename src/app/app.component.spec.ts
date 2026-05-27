import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from './app.component';
import { RouteMetadata, ParsedRouteData } from './model/parsed-route-data.model';
import { RouteImportResult } from './model/route-import.model';
import { Sport } from './model/sport.model';
import { RouteImportService } from './service/route-import.service';

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
    sourcePointCount: 2,
    mappedPointCount: 2,
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

function loadedImportResult(fileName = 'activity.fit'): RouteImportResult {
  return {
    status: 'loaded',
    fileName,
    route: {
      fileName,
      fileSize: 100,
      lastModified: 1,
      metadata: { totalDistance: 1000 } as RouteMetadata,
      path: [{ lat: 1, lng: 2 }],
      pathSet: {
        overview: [{ lat: 1, lng: 2 }],
        standard: [{ lat: 1, lng: 2 }],
        detail: [
          { lat: 1, lng: 2 },
          { lat: 2, lng: 3 },
        ],
      },
      sourcePointCount: 10,
      mappedPointCount: 1,
    },
  };
}

function spyImportFiles(results: RouteImportResult[]): jasmine.Spy {
  const routeImportService = TestBed.inject(RouteImportService);

  return spyOn(routeImportService, 'importFiles').and.callFake(async (options, handlers) => {
    handlers.onBatch(results);
    handlers.onProgress(options.files.length);
  });
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
    const importFilesSpy = spyOn(TestBed.inject(RouteImportService), 'importFiles');

    app.inputFiles = [new File([], 'activity.fit')];
    app.activities = Object.fromEntries(app.sports.map(sport => [sport, false]));

    await app.loadFiles();

    expect(app.errorMessage).toBe('Select at least one activity type to load');
    expect(importFilesSpy).not.toHaveBeenCalled();
  });

  it('should parse .FIT files case-insensitively', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const importFilesSpy = spyImportFiles([loadedImportResult('UPPER.FIT')]);

    app.inputFiles = [new File([], 'UPPER.FIT')];

    await app.loadFiles();

    expect(importFilesSpy).toHaveBeenCalled();
    expect(importFilesSpy.calls.mostRecent().args[0].files[0].name).toBe('UPPER.FIT');
    expect(app.parsedRouteData.length).toBe(1);
    expect(app.parsedRouteData[0].fileName).toBe('UPPER.FIT');
    expect(app.parsedRouteData[0].sourcePointCount).toBe(10);
    expect(app.parsedRouteData[0].mappedPointCount).toBe(1);
  });

  it('should keep the input modal open when no matching routes are parsed', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    spyImportFiles([{ status: 'skipped-sport', fileName: 'activity.fit' }]);

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
    spyImportFiles([
      loadedImportResult('loaded.fit'),
      { status: 'no-gps', fileName: 'nogps.fit' },
      { status: 'decode-error', fileName: 'bad.fit', errorMessage: 'Bad FIT' },
    ]);

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

  it('should report route import worker failures', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    spyOn(TestBed.inject(RouteImportService), 'importFiles').and.rejectWith(new Error('Worker unavailable'));

    app.inputFiles = [new File([], 'activity.fit')];

    await app.loadFiles();

    expect(app.errorMessage).toBe('Worker unavailable');
    expect(app.parsingFiles).toBeFalse();
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
    app['rebuildRouteState']();

    app.setMapViewport();

    expect(app.mapCenter).toEqual(defaultCenter);
  });

  it('should fit the map to route points from visible array paths', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const fitBounds = jasmine.createSpy('fitBounds');
    app.map = { googleMap: { fitBounds } } as unknown as AppComponent['map'];

    app.parsedRouteData = [buildRoute()];
    app['rebuildRouteState']();

    app.setMapViewport();

    expect(app.mapCenter).toEqual({ lat: 15, lng: 30 });
    expect(fitBounds).toHaveBeenCalled();
  });

  it('should fit and total all loaded routes', () => {
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
        id: 'second',
        metadata: { totalDistance: 2000 } as RouteMetadata,
        polylineOptions: { path: [{ lat: 80, lng: 80 }] },
      }),
    ];
    app['rebuildRouteState']();

    app.setMapViewport();

    expect(app.mapCenter).toEqual({ lat: 36.66666666666667, lng: 46.66666666666667 });
    expect(app.totalDistanceText).toBe('1.86 mi');
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
    app['rebuildRouteState']();

    app.setMapViewport();

    expect(app.mapCenter).toEqual({ lat: 35, lng: -90 });
    expect(fitBounds).toHaveBeenCalled();
  });

  it('should select and highlight a route without opening the modal when requested', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const route = buildRoute({ metadata: { sport: Sport.Running } as RouteMetadata });
    app.parsedRouteData = [route];
    app['rebuildRouteState']();

    app.selectRoute(route, false);

    expect(app.selectedRouteId).toBe(route.id);
    expect(route.selected).toBeTrue();
    expect(route.polylineOptions.strokeOpacity).toBe(1);
    expect(route.polylineOptions.strokeWeight).toBe(8);
  });

  it('should delete the selected route from the details modal', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const route = buildRoute();
    const modal = { close: jasmine.createSpy('close') };
    app.parsedRouteData = [route];
    app['rebuildRouteState']();

    app.selectRoute(route, false);
    app.deleteSelectedRoute(modal);

    expect(app.hasLoadedRoutes()).toBeFalse();
    expect(app.selectedRouteId).toBeUndefined();
    expect(modal.close).toHaveBeenCalledWith('Delete route');
  });

  it('should clear route state without reloading the page', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const modalOpen = spyOn(TestBed.inject(NgbModal), 'open');
    app.parsedRouteData = [buildRoute()];
    app['rebuildRouteState']();
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
        totalElapsedTime: 4000,
        totalTimerTime: 3661,
        totalDistance: 1609.344,
        totalAscent: 123,
        totalDescent: 87,
        totalCalories: 425.4,
        avgHeartRate: 143.4,
        maxHeartRate: 171.8,
        maxSpeed: 4,
        avgSpeed: 2,
      }).map(item => [item.label, item.value])
    );

    expect(details['File']).toBe('run.fit');
    expect(details['Sport']).toBe('Running');
    expect(details['Elapsed Time']).toBe('1h 06m 40s');
    expect(details['Active Time']).toBe('1h 01m 01s');
    expect(details['Distance']).toBe('1.00 mi');
    expect(details['Elevation Gain']).toBe('404 ft');
    expect(details['Elevation Loss']).toBe('285 ft');
    expect(details['Calories']).toBe('425 kcal');
    expect(details['Average Heart Rate']).toBe('143 bpm');
    expect(details['Max Heart Rate']).toBe('172 bpm');
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
        totalAscent: 123,
        totalDescent: 87,
        maxSpeed: 4,
        avgSpeed: 2,
      }).map(item => [item.label, item.value])
    );

    expect(details['Distance']).toBe('1.61 km');
    expect(details['Elevation Gain']).toBe('123 m');
    expect(details['Elevation Loss']).toBe('87 m');
    expect(details['Max Speed']).toBe('14.4 km/h');
    expect(details['Average Speed']).toBe('7.2 km/h');
    expect(details['Sport']).toBe('N/A');
  });

  it('should expose export eligibility based on loaded routes', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.parsedRouteData = [];
    app['rebuildRouteState']();
    expect(app.hasLoadedRoutes()).toBeFalse();

    app.parsedRouteData = [buildRoute()];
    app['rebuildRouteState']();
    expect(app.hasLoadedRoutes()).toBeTrue();
  });

  it('should render every loaded route on the map', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.parsedRouteData = Array.from({ length: 501 }, (_, index) => buildRoute({ id: `route-${index + 1}` }));
    app['rebuildRouteState']();

    expect(app.parsedRouteData.length).toBe(501);
    expect(app.totalDistanceText).toBe('N/A');
  });

  it('should switch route paths based on map zoom level', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const route = buildRoute({
      pathSet: {
        overview: [{ lat: 1, lng: 1 }],
        standard: [
          { lat: 1, lng: 1 },
          { lat: 2, lng: 2 },
        ],
        detail: [
          { lat: 1, lng: 1 },
          { lat: 2, lng: 2 },
          { lat: 3, lng: 3 },
        ],
      },
    });
    app.parsedRouteData = [route];
    app.map = { googleMap: { getZoom: () => 14 } } as unknown as AppComponent['map'];
    app.currentPathDetail = 'overview';

    app.onMapZoomChanged();

    expect(route.polylineOptions.path).toEqual(route.pathSet?.detail);
  });

  it('should keep the current map center and zoom when switching map type', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const setMapTypeId = jasmine.createSpy('setMapTypeId');
    const setCenter = jasmine.createSpy('setCenter');
    const setZoom = jasmine.createSpy('setZoom');
    app.map = {
      googleMap: {
        getCenter: () => new google.maps.LatLng(44, -73),
        getZoom: () => 12,
        setMapTypeId,
        setCenter,
        setZoom,
      },
    } as unknown as AppComponent['map'];
    app.mapTypeId = 'satellite';

    app.updateMapType();

    expect(setMapTypeId).toHaveBeenCalledWith('satellite');
    expect(app.mapCenter).toEqual({ lat: 44, lng: -73 });
    expect(app.mapZoom).toBe(12);
    expect(setCenter).toHaveBeenCalledWith({ lat: 44, lng: -73 });
    expect(setZoom).toHaveBeenCalledWith(12);
  });

  it('should track the current map center after panning', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.map = {
      googleMap: {
        getCenter: () => new google.maps.LatLng(41, -72),
      },
    } as unknown as AppComponent['map'];

    app.onMapCenterChanged();

    expect(app.mapCenter).toEqual({ lat: 41, lng: -72 });
  });
});
