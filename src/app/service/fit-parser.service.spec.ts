import { TestBed } from '@angular/core/testing';
import { FitParserService } from './fit-parser.service';

describe('FitParserService', () => {
  let service: FitParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FitParserService);
  });

  it('should ignore null FIT coordinate fields', () => {
    expect(service['toLatLng'](null, 0)).toBeUndefined();
    expect(service['toLatLng'](0, null)).toBeUndefined();
  });

  it('should ignore coordinates outside valid map ranges', () => {
    expect(service['toLatLng'](91 * 11930465, 0)).toBeUndefined();
    expect(service['toLatLng'](0, 181 * 11930465)).toBeUndefined();
  });

  it('should convert valid FIT semicircle coordinates to degrees', () => {
    expect(service['toLatLng'](45 * 11930465, -75 * 11930465)).toEqual([45, -75]);
  });
});
