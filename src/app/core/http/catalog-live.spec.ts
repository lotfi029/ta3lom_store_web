import { TestBed } from '@angular/core/testing';
import { STORE_API_URL } from '../api/store-api-url';
import { CatalogLive } from './catalog-live';

class FakeEventSource {
  static last: FakeEventSource | null = null;
  readonly handlers = new Map<string, (e: MessageEvent<string>) => void>();
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(type: string, handler: (e: MessageEvent<string>) => void): void {
    this.handlers.set(type, handler);
  }
  close(): void {
    this.closed = true;
  }
  emit(type: string, data: string): void {
    this.handlers.get(type)?.({ data } as MessageEvent<string>);
  }
}

describe('CatalogLive', () => {
  beforeEach(() => {
    FakeEventSource.last = null;
    vi.stubGlobal('EventSource', FakeEventSource);
    TestBed.configureTestingModule({
      providers: [{ provide: STORE_API_URL, useValue: 'https://api.test/v1' }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens one stream on the API and calls listeners on every catalogue change', () => {
    const live = TestBed.inject(CatalogLive);
    let calls = 0;
    live.listen(() => calls++);
    const source = FakeEventSource.last as FakeEventSource;
    expect(source.url).toBe('https://api.test/v1/catalog/events');

    source.emit('ready', '0'); // first answer: an edit may have landed before the stream opened
    expect(calls).toBe(1);
    source.emit('catalog', '1');
    source.emit('catalog', '2');
    expect(calls).toBe(3);
  });

  it('re-reads after a reconnect only when the version moved meanwhile', () => {
    const live = TestBed.inject(CatalogLive);
    let calls = 0;
    live.listen(() => calls++);
    const source = FakeEventSource.last as FakeEventSource;
    source.emit('ready', '4');
    source.emit('ready', '4'); // reconnect, nothing missed
    expect(calls).toBe(1);
    source.emit('ready', '0'); // API restarted
    expect(calls).toBe(2);
  });

  it('shares the stream and closes it with the last listener', () => {
    const live = TestBed.inject(CatalogLive);
    const stopA = live.listen(() => undefined);
    const source = FakeEventSource.last as FakeEventSource;
    const stopB = live.listen(() => undefined);
    expect(FakeEventSource.last).toBe(source);
    stopA();
    expect(source.closed).toBe(false);
    stopB();
    expect(source.closed).toBe(true);
  });
});
