import { UnitSystem } from '../app/model/unit-system.model';

export interface EnvironmentConfig {
  googleMapsApiKey: string;
  defaultMapCenter: google.maps.LatLngLiteral;
  defaultMapZoom: number;
  defaultStrokeColor: string;
  defaultStrokeOpacity: number;
  defaultStrokeWeight: number;
  defaultUnitSystem: UnitSystem;
}

export const environment: EnvironmentConfig = {
  googleMapsApiKey: '',
  defaultMapCenter: { lat: 37, lng: -100 },
  defaultMapZoom: 8,
  defaultStrokeColor: '#000000',
  defaultStrokeOpacity: 0.8,
  defaultStrokeWeight: 5,
  defaultUnitSystem: 'imperial',
};
