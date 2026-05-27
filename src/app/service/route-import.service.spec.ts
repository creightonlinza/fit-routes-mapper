import { TestBed } from '@angular/core/testing';
import { RouteImportResult, RouteImportWorkerMessage } from '../model/route-import.model';
import { Sport } from '../model/sport.model';
import { ROUTE_IMPORT_WORKER_FACTORY, RouteImportService } from './route-import.service';

class FakeWorker {
  onmessage: ((event: MessageEvent<RouteImportWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  request: unknown;
  terminated = false;

  constructor(private readonly messages: RouteImportWorkerMessage[] = []) {}

  postMessage(request: unknown): void {
    this.request = request;
    setTimeout(() => {
      this.messages.forEach(message => this.onmessage?.({ data: message } as MessageEvent<RouteImportWorkerMessage>));
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('RouteImportService', () => {
  let fakeWorker: FakeWorker;
  let workerMessages: RouteImportWorkerMessage[];

  beforeEach(() => {
    workerMessages = [];
    fakeWorker = new FakeWorker(workerMessages);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ROUTE_IMPORT_WORKER_FACTORY,
          useValue: () => fakeWorker as unknown as Worker,
        },
      ],
    });
  });

  it('should forward worker batch results and progress', async () => {
    const results: RouteImportResult[] = [
      { status: 'loaded', fileName: 'loaded.fit' },
      { status: 'skipped-sport', fileName: 'walk.fit' },
      { status: 'no-gps', fileName: 'nogps.fit' },
      { status: 'decode-error', fileName: 'bad.fit', errorMessage: 'Bad FIT' },
      { status: 'read-error', fileName: 'read.fit', errorMessage: 'Cannot read' },
    ];
    workerMessages.push({ type: 'batch', processed: 5, results }, { type: 'complete', processed: 5 });
    const service = TestBed.inject(RouteImportService);
    const batches: RouteImportResult[][] = [];
    const progress: number[] = [];

    await service.importFiles(
      {
        files: [new File([], 'loaded.fit')],
        activities: [Sport.Running],
      },
      {
        onBatch: batch => batches.push(batch),
        onProgress: processed => progress.push(processed),
      }
    );

    expect(batches).toEqual([results]);
    expect(progress).toEqual([5, 5]);
    expect(fakeWorker.terminated).toBeTrue();
  });

  it('should reject when the worker reports an error', async () => {
    workerMessages.push({ type: 'error', errorMessage: 'Worker failed' });
    const service = TestBed.inject(RouteImportService);

    await expectAsync(
      service.importFiles(
        {
          files: [new File([], 'activity.fit')],
          activities: [Sport.Running],
        },
        {
          onBatch: () => undefined,
          onProgress: () => undefined,
        }
      )
    ).toBeRejectedWithError('Worker failed');

    expect(fakeWorker.terminated).toBeTrue();
  });

  it('should reject when worker creation fails', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ROUTE_IMPORT_WORKER_FACTORY,
          useValue: () => {
            throw new Error('No worker support');
          },
        },
      ],
    });
    const service = TestBed.inject(RouteImportService);

    await expectAsync(
      service.importFiles(
        {
          files: [new File([], 'activity.fit')],
          activities: [Sport.Running],
        },
        {
          onBatch: () => undefined,
          onProgress: () => undefined,
        }
      )
    ).toBeRejectedWithError('No worker support');
  });
});
