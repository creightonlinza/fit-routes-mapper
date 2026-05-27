import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoogleMap, GoogleMapsModule } from '@angular/google-maps';

import { Loader } from '@googlemaps/js-api-loader';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { FitParserService } from './service/fit-parser.service';
import { ParsedRouteData, RouteMetadata } from './model/parsed-route-data.model';
import { Sport } from './model/sport.model';
import { UnitSystem } from './model/unit-system.model';
import { EnvironmentConfig, environment } from '../environments/environment';

interface RouteDetailItem {
  label: string;
  value: string;
}

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

  private fitParserService = inject(FitParserService);
  private modalService = inject(NgbModal);
  private modalRef?: NgbModalRef;
  private appConfig: EnvironmentConfig = environment;

  mapCenter = environment.defaultMapCenter;
  mapZoom = environment.defaultMapZoom;
  sports = Object.values(Sport);
  inputFiles: File[] = [];
  parsedRouteData: ParsedRouteData[] = [];
  routeMetadata: Partial<RouteMetadata> = {};
  mapsApiLoaded = false;
  parsingFiles = false;
  errorMessage = '';
  fileIndex = 0;
  fileCount = 0;
  unitSystem: UnitSystem = environment.defaultUnitSystem;

  // default input options
  activities: Record<string, boolean> = {
    cycling: true,
    hiking: false,
    kayaking: false,
    running: true,
    walking: false,
  };
  randomizeRouteColor = false;

  async ngAfterViewInit(): Promise<void> {
    this.appConfig = await this.loadAppConfig();
    this.mapCenter = this.appConfig.defaultMapCenter;
    this.mapZoom = this.appConfig.defaultMapZoom;
    this.unitSystem = this.appConfig.defaultUnitSystem;
    this.loadMap();
    this.modalRef = this.modalService.open(this.inputModal, { centered: true, beforeDismiss: () => false });
  }

  triggerFileInput(event: MouseEvent): void {
    event.preventDefault();
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

    const fitFiles = this.inputFiles.filter(file => file.name.endsWith('.fit'));
    if (fitFiles.length === 0) {
      this.errorMessage = 'No .fit files found';
      return;
    }

    this.fileCount = fitFiles.length;
    this.parsingFiles = true;
    const loadedRouteCount = this.parsedRouteData.length;

    for (const [index, file] of fitFiles.entries()) {
      this.fileIndex = index + 1;
      const initialRouteData: ParsedRouteData = {
        polylineOptions: {
          strokeColor: this.randomizeRouteColor ? this.generateRandomColor() : this.appConfig.defaultStrokeColor,
          strokeOpacity: this.appConfig.defaultStrokeOpacity,
          strokeWeight: this.appConfig.defaultStrokeWeight,
          clickable: true,
          path: [],
        },
      };

      const parsedRouteData = await this.fitParserService.parseFitFile(
        file,
        selectedActivities,
        initialRouteData
      );

      if (parsedRouteData) {
        this.parsedRouteData.push(parsedRouteData);
      }
    }

    if (this.parsedRouteData.length === loadedRouteCount) {
      this.errorMessage = 'No matching routes were found in the selected .fit files';
      this.parsingFiles = false;
      return;
    }

    this.setMapViewport();
    this.parsingFiles = false;
    this.modalRef?.close();
  }

  setMapViewport(): void {
    const bounds = this.buildRouteBounds();
    if (!bounds) {
      return;
    }

    this.mapCenter = bounds.getCenter().toJSON();

    if (this.map?.googleMap) {
      this.map.googleMap.fitBounds(bounds);
    }
  }

  parsedPercent(): number {
    return Math.round((this.fileIndex / this.fileCount) * 100);
  }

  onPolylineClick(event: google.maps.MapMouseEvent, routeMetadata?: RouteMetadata): void {
    if (routeMetadata) {
      this.routeMetadata = routeMetadata;
      this.modalService.open(this.routeDetailModal, { centered: true });
    }
  }

  routeDetailItems(routeMetadata: Partial<RouteMetadata> = this.routeMetadata): RouteDetailItem[] {
    return [
      { label: 'Sport', value: this.formatSport(routeMetadata.sport) },
      { label: 'Start Time', value: this.formatDate(routeMetadata.startTime) },
      { label: 'Elapsed Time', value: this.formatDuration(routeMetadata.totalTimerTime) },
      { label: 'Distance', value: this.formatDistance(routeMetadata.totalDistance) },
      { label: 'Calories', value: this.formatCalories(routeMetadata.totalCalories) },
      { label: 'Max Speed', value: this.formatSpeed(routeMetadata.maxSpeed) },
      { label: 'Average Speed', value: this.formatSpeed(routeMetadata.avgSpeed) },
    ];
  }

  hasLoadedRoutes(): boolean {
    return this.parsedRouteData.length > 0;
  }

  totalDistanceLabel(): string {
    return this.formatDistance(this.totalDistanceMeters());
  }

  reset(): void {
    window.location.reload();
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

  private formatDistance(meters: number | undefined): string {
    if (!this.isFiniteNumber(meters)) {
      return 'N/A';
    }

    if (this.unitSystem === 'metric') {
      return `${(meters / 1000).toFixed(2)} km`;
    }

    return `${(meters / 1609.344).toFixed(2)} mi`;
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

  private totalDistanceMeters(): number | undefined {
    let totalDistance = 0;
    let hasDistance = false;

    for (const routeData of this.parsedRouteData) {
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

  private buildRouteBounds(): google.maps.LatLngBounds | undefined {
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    for (const routeData of this.parsedRouteData) {
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
}
