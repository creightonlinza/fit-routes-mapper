import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { FitParserService } from './service/fit-parser.service';

describe('AppComponent', () => {
  beforeEach(async () => {
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
});
