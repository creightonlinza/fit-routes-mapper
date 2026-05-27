import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoogleMap, GoogleMapsModule } from '@angular/google-maps';

import { Loader } from '@googlemaps/js-api-loader';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { ParsedRouteData, RouteMetadata, RoutePathDetail, RoutePathSet } from './model/parsed-route-data.model';
import {
  DEFAULT_ROUTE_IMPORT_BATCH_SIZE,
  DEFAULT_SIMPLIFICATION_TOLERANCE_METERS,
  ImportedRoutePayload,
  RouteImportResult,
} from './model/route-import.model';
import { Sport } from './model/sport.model';
import { UnitSystem } from './model/unit-system.model';
import { RouteImportService } from './service/route-import.service';
import { RouteExportService } from './service/route-export.service';
import { EnvironmentConfig, environment } from '../environments/environment';

type ColorMode = 'default' | 'random' | 'sport' | 'date';

interface RouteDetailItem {
  label: string;
  value: string;
}

interface ParsingSummary {
  loaded: number;
  skippedSport: number;
  noGps: number;
  decodeError: number;
  readError: number;
  nonFit: number;
}

interface ClosableModal {
  close: (reason?: unknown) => void;
}

const SPORT_COLORS: Record<Sport, string> = {
  [Sport.Cycling]: '#0d6efd',
  [Sport.Hiking]: '#198754',
  [Sport.Kayaking]: '#0dcaf0',
  [Sport.Running]: '#dc3545',
  [Sport.Walking]: '#6f42c1',
};

const DATE_COLOR_START = { r: 13, g: 110, b: 253 };
const DATE_COLOR_END = { r: 220, g: 53, b: 69 };
const OVERVIEW_PATH_MAX_ZOOM = 10;
const STANDARD_PATH_MAX_ZOOM = 13;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleMapsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('inputModal') inputModal!: TemplateRef<unknown>;
  @ViewChild('routeDetailModal') routeDetailModal!: TemplateRef<unknown>;
  @ViewChild(GoogleMap) map?: GoogleMap;

  private routeImportService = inject(RouteImportService);
  private routeExportService = inject(RouteExportService);
  private modalService = inject(NgbModal);
  private modalRef?: NgbModalRef;
  private appConfig: EnvironmentConfig = environment;
  private routeId = 0;

  mapCenter = environment.defaultMapCenter;
  mapZoom = environment.defaultMapZoom;
  currentPathDetail: RoutePathDetail = this.pathDetailForZoom(this.mapZoom);
  sports = Object.values(Sport);
  inputFiles: File[] = [];
  parsedRouteData: ParsedRouteData[] = [];
  totalDistanceText = 'N/A';
  routeMetadata: Partial<RouteMetadata> = {};
  routeDetailFileName = '';
  mapsApiLoaded = false;
  parsingFiles = false;
  errorMessage = '';
  fileIndex = 0;
  fileCount = 0;
  unitSystem: UnitSystem = environment.defaultUnitSystem;
  colorMode: ColorMode = 'default';
  routeWidth = environment.defaultStrokeWeight;
  routeOpacity = environment.defaultStrokeOpacity;
  drawerOpen = true;
  selectedRouteId?: string;
  parsingSummary: ParsingSummary = this.emptyParsingSummary();
  hasParsingSummary = false;

  // default input options
  activities: Record<string, boolean> = {
    cycling: true,
    hiking: false,
    kayaking: false,
    running: true,
    walking: false,
  };

  async ngAfterViewInit(): Promise<void> {
    this.appConfig = await this.loadAppConfig();
    this.mapCenter = this.appConfig.defaultMapCenter;
    this.mapZoom = this.appConfig.defaultMapZoom;
    this.unitSystem = this.appConfig.defaultUnitSystem;
    this.routeWidth = this.appConfig.defaultStrokeWeight;
    this.routeOpacity = this.appConfig.defaultStrokeOpacity;
    this.loadMap();
    this.openInputModal(false);
  }

  triggerFileInput(event?: MouseEvent): void {
    event?.preventDefault();
    this.fileInput.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (files && files.length) {
      this.inputFiles = Array.from(files);
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.inputFiles = Array.from(input.files);
  }

  async loadFiles(): Promise<void> {
    this.errorMessage = '';

    const selectedActivities = this.selectedActivities();
    if (selectedActivities.length === 0) {
      this.errorMessage = 'Select at least one activity type to load';
      return;
    }

    const nonFit = this.inputFiles.filter(file => !this.isFitFile(file)).length;
    const fitFiles = this.inputFiles.filter(file => this.isFitFile(file));
    if (fitFiles.length === 0) {
      this.parsingSummary = { ...this.emptyParsingSummary(), nonFit };
      this.hasParsingSummary = nonFit > 0;
      this.errorMessage = 'No .fit files found';
      return;
    }

    this.fileCount = fitFiles.length;
    this.fileIndex = 0;
    this.parsingFiles = true;
    this.parsingSummary = { ...this.emptyParsingSummary(), nonFit };
    this.hasParsingSummary = false;
    const loadedRouteCount = this.parsedRouteData.length;

    try {
      await this.routeImportService.importFiles(
        {
          files: fitFiles,
          activities: selectedActivities,
          simplificationToleranceMeters: DEFAULT_SIMPLIFICATION_TOLERANCE_METERS,
          batchSize: DEFAULT_ROUTE_IMPORT_BATCH_SIZE,
        },
        {
          onBatch: results => this.addImportResults(results),
          onProgress: processed => {
            this.fileIndex = processed;
          },
        }
      );
    } catch (error) {
      this.parsingFiles = false;
      this.hasParsingSummary = true;
      this.errorMessage = this.errorMessageFrom(error);
      return;
    }

    if (this.colorMode === 'date') {
      this.applyDateColors();
    }

    this.refreshAllPolylineOptions();
    this.rebuildRouteState();
    this.hasParsingSummary = true;
    this.parsingFiles = false;
    this.inputFiles = [];
    this.clearNativeFileInput();

    if (this.parsedRouteData.length === loadedRouteCount) {
      this.errorMessage = 'No matching routes were found in the selected .fit files';
      return;
    }

    this.setMapViewport();
    this.modalRef?.close();
    this.drawerOpen = true;
  }

  setMapViewport(): void {
    const bounds = this.buildRouteBounds(this.parsedRouteData);
    if (!bounds) {
      return;
    }

    this.mapCenter = bounds.getCenter().toJSON();

    if (this.map?.googleMap) {
      this.map.googleMap.fitBounds(bounds);
    }
  }

  onMapZoomChanged(): void {
    const zoom = this.map?.googleMap?.getZoom();
    if (!this.isFiniteNumber(zoom)) {
      return;
    }

    this.mapZoom = zoom;
    const nextPathDetail = this.pathDetailForZoom(zoom);
    if (nextPathDetail === this.currentPathDetail) {
      return;
    }

    this.currentPathDetail = nextPathDetail;
    this.applyRoutePathDetail();
  }

  parsedPercent(): number {
    return this.fileCount ? Math.round((this.fileIndex / this.fileCount) * 100) : 0;
  }

  onPolylineClick(event: google.maps.MapMouseEvent, route: ParsedRouteData): void {
    this.selectRoute(route, true);
  }

  onPolylineMouseOver(route: ParsedRouteData): void {
    route.hovered = true;
    this.updatePolylineOptions(route);
  }

  onPolylineMouseOut(route: ParsedRouteData): void {
    route.hovered = false;
    this.updatePolylineOptions(route);
  }

  routeDetailItems(routeMetadata: Partial<RouteMetadata> = this.routeMetadata): RouteDetailItem[] {
    const items = [
      { label: 'File', value: this.routeDetailFileName || 'N/A' },
      { label: 'Sport', value: this.formatSport(routeMetadata.sport) },
      { label: 'Start Time', value: this.formatDate(routeMetadata.startTime) },
      { label: 'Elapsed Time', value: this.formatDuration(routeMetadata.totalElapsedTime ?? routeMetadata.totalTimerTime) },
    ];

    if (this.hasDistinctTimerTime(routeMetadata)) {
      items.push({ label: 'Active Time', value: this.formatDuration(routeMetadata.totalTimerTime) });
    }

    items.push(
      { label: 'Distance', value: this.formatDistance(routeMetadata.totalDistance) },
      { label: 'Elevation Gain', value: this.formatElevation(routeMetadata.totalAscent) },
      { label: 'Elevation Loss', value: this.formatElevation(routeMetadata.totalDescent) },
      { label: 'Calories', value: this.formatCalories(routeMetadata.totalCalories) },
      { label: 'Average Heart Rate', value: this.formatHeartRate(routeMetadata.avgHeartRate) },
      { label: 'Max Heart Rate', value: this.formatHeartRate(routeMetadata.maxHeartRate) },
      { label: 'Max Speed', value: this.formatSpeed(routeMetadata.maxSpeed) },
      { label: 'Average Speed', value: this.formatSpeed(routeMetadata.avgSpeed) }
    );

    return items;
  }

  hasLoadedRoutes(): boolean {
    return this.parsedRouteData.length > 0;
  }

  parsingSummaryItems(): RouteDetailItem[] {
    return [
      { label: 'Loaded', value: String(this.parsingSummary.loaded) },
      { label: 'Skipped by sport', value: String(this.parsingSummary.skippedSport) },
      { label: 'No GPS data', value: String(this.parsingSummary.noGps) },
      { label: 'Decode errors', value: String(this.parsingSummary.decodeError) },
      { label: 'Read errors', value: String(this.parsingSummary.readError) },
      { label: 'Non-FIT files', value: String(this.parsingSummary.nonFit) },
    ];
  }

  openInputModal(clearError = true): void {
    if (clearError) {
      this.errorMessage = '';
    }
    this.modalRef = this.modalService.open(this.inputModal, { centered: true, beforeDismiss: () => false });
  }

  toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
  }

  clearRoutes(): void {
    this.parsedRouteData = [];
    this.totalDistanceText = 'N/A';
    this.inputFiles = [];
    this.routeMetadata = {};
    this.routeDetailFileName = '';
    this.selectedRouteId = undefined;
    this.errorMessage = '';
    this.fileIndex = 0;
    this.fileCount = 0;
    this.parsingFiles = false;
    this.parsingSummary = this.emptyParsingSummary();
    this.hasParsingSummary = false;
    this.mapCenter = this.appConfig.defaultMapCenter;
    this.mapZoom = this.appConfig.defaultMapZoom;
    this.clearNativeFileInput();
    this.openInputModal();
  }

  updateRouteStyles(): void {
    this.refreshAllPolylineOptions();
    this.rebuildRouteState();
  }

  updateUnitSystem(): void {
    this.rebuildRouteState();
  }

  exportGeoJson(): void {
    if (!this.hasLoadedRoutes()) {
      return;
    }

    this.downloadTextFile('fit-routes.geojson', 'application/geo+json', this.routeExportService.buildGeoJson(this.parsedRouteData));
  }

  exportCsv(): void {
    if (!this.hasLoadedRoutes()) {
      return;
    }

    this.downloadTextFile('fit-routes.csv', 'text/csv', this.routeExportService.buildCsv(this.parsedRouteData));
  }

  selectRoute(route: ParsedRouteData, openModal: boolean): void {
    const previouslySelectedRoute = this.parsedRouteData.find(routeData => routeData.id === this.selectedRouteId);
    this.selectedRouteId = route.id;
    this.routeMetadata = route.metadata ?? {};
    this.routeDetailFileName = route.fileName;

    if (previouslySelectedRoute && previouslySelectedRoute.id !== route.id) {
      previouslySelectedRoute.selected = false;
      this.updatePolylineOptions(previouslySelectedRoute);
    }

    route.selected = true;
    this.updatePolylineOptions(route);
    this.rebuildRouteState();

    if (openModal) {
      this.modalService.open(this.routeDetailModal, { centered: true });
    }
  }

  deleteSelectedRoute(modal: ClosableModal): void {
    const selectedRoute = this.parsedRouteData.find(route => route.id === this.selectedRouteId);
    if (!selectedRoute) {
      return;
    }

    this.deleteRoute(selectedRoute);
    modal.close('Delete route');
  }

  trackRouteById(index: number, route: ParsedRouteData): string {
    return route.id;
  }

  private loadMap(): void {
    if (!this.appConfig.googleMapsApiKey) {
      this.errorMessage = 'Google Maps API key is not configured. Copy public/app-config.example.json to public/app-config.json and add your key.';
      return;
    }

    new Loader({
      apiKey: this.appConfig.googleMapsApiKey,
      version: 'weekly',
    })
      .importLibrary('maps')
      .then(() => {
        this.mapsApiLoaded = true;
      })
      .catch(e => {
        this.errorMessage = 'Error loading Google Maps API';
        console.error('Error loading Google Maps API:', e);
      });
  }

  private async loadAppConfig(): Promise<EnvironmentConfig> {
    try {
      const response = await fetch('app-config.json', { cache: 'no-store' });
      if (!response.ok) {
        return environment;
      }

      const localConfig = (await response.json()) as Partial<EnvironmentConfig>;

      return {
        ...environment,
        ...localConfig,
        defaultMapCenter: {
          ...environment.defaultMapCenter,
          ...(localConfig.defaultMapCenter ?? {}),
        },
      };
    } catch {
      return environment;
    }
  }

  private selectedActivities(): Sport[] {
    return this.sports.filter(sport => this.activities[sport]);
  }

  private createRouteData(importedRoute: ImportedRoutePayload): ParsedRouteData {
    const baseStrokeColor = this.initialRouteColor();

    return {
      id: `route-${++this.routeId}`,
      fileName: importedRoute.fileName,
      fileSize: importedRoute.fileSize,
      lastModified: importedRoute.lastModified,
      sourcePointCount: importedRoute.sourcePointCount,
      mappedPointCount: importedRoute.mappedPointCount,
      visible: true,
      selected: false,
      hovered: false,
      baseStrokeColor,
      metadata: importedRoute.metadata,
      pathSet: importedRoute.pathSet,
      exportPath: importedRoute.pathSet.detail,
      polylineOptions: {
        strokeColor: baseStrokeColor,
        strokeOpacity: this.routeOpacity,
        strokeWeight: this.routeWidth,
        clickable: true,
        path: this.pathForDetail(importedRoute.pathSet),
      },
    };
  }

  private prepareLoadedRoute(route: ParsedRouteData): void {
    if (this.colorMode === 'sport' && route.metadata?.sport) {
      route.baseStrokeColor = SPORT_COLORS[route.metadata.sport] ?? this.appConfig.defaultStrokeColor;
    }

    this.updatePolylineOptions(route);
  }

  private addImportResults(results: RouteImportResult[]): void {
    for (const result of results) {
      this.recordImportResult(result);

      if (result.status === 'loaded' && result.route) {
        const routeData = this.createRouteData(result.route);
        this.prepareLoadedRoute(routeData);
        this.parsedRouteData.push(routeData);
      }
    }

    this.rebuildRouteState();
  }

  private recordImportResult(importResult: RouteImportResult): void {
    switch (importResult.status) {
      case 'loaded':
        this.parsingSummary.loaded += 1;
        break;
      case 'skipped-sport':
        this.parsingSummary.skippedSport += 1;
        break;
      case 'no-gps':
        this.parsingSummary.noGps += 1;
        break;
      case 'decode-error':
        this.parsingSummary.decodeError += 1;
        break;
      case 'read-error':
        this.parsingSummary.readError += 1;
        break;
    }
  }

  private refreshAllPolylineOptions(): void {
    this.parsedRouteData.forEach(route => this.updatePolylineOptions(route));
  }

  private rebuildRouteState(): void {
    this.totalDistanceText = this.formatDistance(this.totalDistanceMeters(this.parsedRouteData));
  }

  private applyRoutePathDetail(): void {
    for (const route of this.parsedRouteData) {
      if (!route.pathSet) {
        continue;
      }

      route.polylineOptions = {
        ...route.polylineOptions,
        path: this.pathForDetail(route.pathSet),
      };
    }
  }

  private pathForDetail(pathSet: RoutePathSet): google.maps.LatLngLiteral[] {
    return pathSet[this.currentPathDetail];
  }

  private pathDetailForZoom(zoom: number): RoutePathDetail {
    if (zoom <= OVERVIEW_PATH_MAX_ZOOM) {
      return 'overview';
    }

    if (zoom <= STANDARD_PATH_MAX_ZOOM) {
      return 'standard';
    }

    return 'detail';
  }

  private deleteRoute(route: ParsedRouteData): void {
    this.parsedRouteData = this.parsedRouteData.filter(item => item.id !== route.id);
    this.selectedRouteId = undefined;
    route.selected = false;
    this.routeMetadata = {};
    this.routeDetailFileName = '';
    this.rebuildRouteState();
  }

  private updatePolylineOptions(route: ParsedRouteData): void {
    const highlighted = route.selected || route.hovered;
    const routeWidth = Number(this.routeWidth);
    const routeOpacity = Number(this.routeOpacity);

    route.polylineOptions = {
      ...route.polylineOptions,
      strokeColor: route.baseStrokeColor,
      strokeOpacity: highlighted ? 1 : routeOpacity,
      strokeWeight: highlighted ? routeWidth + 3 : routeWidth,
      zIndex: highlighted ? 1000 : 1,
      clickable: true,
    };
  }

  private initialRouteColor(): string {
    if (this.colorMode === 'random') {
      return this.generateRandomColor();
    }

    return this.appConfig.defaultStrokeColor;
  }

  private applyDateColors(): void {
    const datedRoutes = this.parsedRouteData
      .filter(route => route.metadata?.startTime)
      .sort((first, second) => {
        const firstTime = new Date(first.metadata?.startTime ?? 0).getTime();
        const secondTime = new Date(second.metadata?.startTime ?? 0).getTime();
        return firstTime - secondTime;
      });

    if (datedRoutes.length === 0) {
      return;
    }

    datedRoutes.forEach((route, index) => {
      const percent = datedRoutes.length === 1 ? 0 : index / (datedRoutes.length - 1);
      route.baseStrokeColor = this.interpolateColor(percent);
    });
  }

  private interpolateColor(percent: number): string {
    const r = this.interpolateChannel(DATE_COLOR_START.r, DATE_COLOR_END.r, percent);
    const g = this.interpolateChannel(DATE_COLOR_START.g, DATE_COLOR_END.g, percent);
    const b = this.interpolateChannel(DATE_COLOR_START.b, DATE_COLOR_END.b, percent);

    return `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
  }

  private interpolateChannel(start: number, end: number, percent: number): number {
    return Math.round(start + (end - start) * percent);
  }

  private toHex(value: number): string {
    return value.toString(16).padStart(2, '0');
  }

  private isFitFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.fit');
  }

  private formatSport(sport: Sport | undefined): string {
    return sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : 'N/A';
  }

  private formatDate(date: Date | undefined): string {
    if (!date) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
  }

  private formatDuration(seconds: number | undefined): string {
    if (!this.isFiniteNumber(seconds)) {
      return 'N/A';
    }

    const roundedSeconds = Math.round(seconds);
    const hours = Math.floor(roundedSeconds / 3600);
    const minutes = Math.floor((roundedSeconds % 3600) / 60);
    const remainingSeconds = roundedSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${remainingSeconds
        .toString()
        .padStart(2, '0')}s`;
    }

    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }

  private hasDistinctTimerTime(routeMetadata: Partial<RouteMetadata>): boolean {
    if (!this.isFiniteNumber(routeMetadata.totalElapsedTime) || !this.isFiniteNumber(routeMetadata.totalTimerTime)) {
      return false;
    }

    return Math.round(routeMetadata.totalElapsedTime) !== Math.round(routeMetadata.totalTimerTime);
  }

  private formatDistance(meters: number | undefined): string {
    if (!this.isFiniteNumber(meters)) {
      return 'N/A';
    }

    if (this.unitSystem === 'metric') {
      return `${(meters / 1000).toFixed(2)} km`;
    }

    return `${(meters / 1609.344).toFixed(2)} mi`;
  }

  private formatElevation(meters: number | undefined): string {
    if (!this.isFiniteNumber(meters)) {
      return 'N/A';
    }

    if (this.unitSystem === 'metric') {
      return `${Math.round(meters)} m`;
    }

    return `${Math.round(meters * 3.280839895)} ft`;
  }

  private formatSpeed(metersPerSecond: number | undefined): string {
    if (!this.isFiniteNumber(metersPerSecond)) {
      return 'N/A';
    }

    if (this.unitSystem === 'metric') {
      return `${(metersPerSecond * 3.6).toFixed(1)} km/h`;
    }

    return `${(metersPerSecond * 2.2369362921).toFixed(1)} mph`;
  }

  private formatCalories(calories: number | undefined): string {
    if (!this.isFiniteNumber(calories)) {
      return 'N/A';
    }

    return `${Math.round(calories)} kcal`;
  }

  private formatHeartRate(beatsPerMinute: number | undefined): string {
    if (!this.isFiniteNumber(beatsPerMinute)) {
      return 'N/A';
    }

    return `${Math.round(beatsPerMinute)} bpm`;
  }

  private totalDistanceMeters(routes: ParsedRouteData[]): number | undefined {
    let totalDistance = 0;
    let hasDistance = false;

    for (const routeData of routes) {
      const distance = routeData.metadata?.totalDistance;

      if (this.isFiniteNumber(distance)) {
        totalDistance += distance;
        hasDistance = true;
      }
    }

    return hasDistance ? totalDistance : undefined;
  }

  private isFiniteNumber(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private buildRouteBounds(routes: ParsedRouteData[]): google.maps.LatLngBounds | undefined {
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    for (const routeData of routes) {
      for (const point of this.routePathPoints(routeData.polylineOptions.path)) {
        bounds.extend(point);
        hasPoints = true;
      }
    }

    return hasPoints ? bounds : undefined;
  }

  private routePathPoints(path: google.maps.PolylineOptions['path']): google.maps.LatLngLiteral[] {
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

  private generateRandomColor(): string {
    const randomColor = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    return `#${randomColor}`;
  }

  private emptyParsingSummary(): ParsingSummary {
    return {
      loaded: 0,
      skippedSport: 0,
      noGps: 0,
      decodeError: 0,
      readError: 0,
      nonFit: 0,
    };
  }

  private clearNativeFileInput(): void {
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private downloadTextFile(fileName: string, type: string, contents: string): void {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private errorMessageFrom(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown route import error.';
  }
}
