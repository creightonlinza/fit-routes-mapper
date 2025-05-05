import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { Loader } from '@googlemaps/js-api-loader';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { FitParserService } from './service/fit-parser.service';
import { ParsedRouteData, RouteMetadata } from './model/parsed-route-data.model';
import { Sport } from './model/sport.model';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleMapsModule, MatProgressBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('inputModal') inputModal!: TemplateRef<any>;
  @ViewChild('routeDetailModal') routeDetailModal!: TemplateRef<any>;

  private fitParserService = inject(FitParserService);
  private modalService = inject(NgbModal);
  private modalRef?: NgbModalRef;

  mapCenter = environment.defaultMapCenter;
  mapZoom = environment.defaultMapZoom;
  sports = Object.values(Sport);
  inputFiles: File[] = [];
  parsedRouteData: ParsedRouteData[] = [];
  routeMetadata: RouteMetadata = {} as RouteMetadata;
  mapsApiLoaded = false;
  parsingFiles = false;
  errorMessage = '';
  fileIndex = 0;
  fileCount = 0;

  // default input options
  activities: { [key: string]: boolean } = {
    cycling: true,
    hiking: false,
    kayaking: false,
    running: true,
    walking: false,
  };
  randomizeRouteColor = false;

  ngAfterViewInit(): void {
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
    const fitFiles = this.inputFiles.filter(file => file.name.endsWith('.fit'));
    if (fitFiles.length === 0) {
      this.errorMessage = 'No .fit files found';
      return;
    }

    this.fileCount = fitFiles.length;
    this.parsingFiles = true;

    for (const [index, file] of fitFiles.entries()) {
      this.fileIndex = index + 1;
      const initialRouteData: ParsedRouteData = {
        polylineOptions: {
          strokeColor: this.randomizeRouteColor ? this.generateRandomColor() : environment.defaultStrokeColor,
          strokeOpacity: environment.defaultStrokeOpacity,
          strokeWeight: environment.defaultStrokeWeight,
          clickable: true,
          path: [],
        },
      };

      const parsedRouteData = await this.fitParserService.parseFitFile(
        file,
        this.selectedActivities(),
        initialRouteData
      );

      if (parsedRouteData) {
        this.parsedRouteData.push(parsedRouteData);
      }
    }

    setTimeout(() => {
      this.setMapCenter();
      this.parsingFiles = false;
      this.modalRef?.close();
    }, 2000);
  }

  setMapCenter(): void {
    // Set the map center to the first point of the first route
    const path = this.parsedRouteData[0]?.polylineOptions.path;
    if (path instanceof google.maps.MVCArray) {
      this.mapCenter = path.getAt(0).toJSON() as google.maps.LatLngLiteral;
    } else if (Array.isArray(path)) {
      this.mapCenter = path[0] as google.maps.LatLngLiteral;
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

  reset(): void {
    window.location.reload();
  }

  private loadMap(): void {
    new Loader({
      apiKey: environment.googleMapsApiKey,
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

  private selectedActivities(): Sport[] {
    return this.sports.filter(sport => this.activities[sport]);
  }

  private generateRandomColor(): string {
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    return `#${randomColor}`;
  }
}
