import { isPlatformBrowser } from '@angular/common';
import {
  ApplicationRef,
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  afterNextRender,
  inject,
} from '@angular/core';
import { STORE_API_URL } from '../api/store-api-url';

/** Anything with a `reload()` — every `HttpResourceRef` qualifies. */
interface Reloadable {
  reload(): boolean;
}

/**
 * Wait after the page is stable before opening the stream: it is not needed for the first paint, and an open
 * connection during the load would keep Lighthouse's "network quiet" from settling (CI gates).
 */
export const CATALOG_LIVE_DELAY_MS = 4000;

/**
 * Live catalogue updates (API DECISIONS LIVE-1): one shared `EventSource` on `GET /v1/catalog/events` while at least one
 * public page listens. The API sends `ready` on connect and `catalog` after every staff catalogue save; each listener
 * then re-reads its resources (no-cache + ETag on the API, so an unchanged read is a 304). The first `ready`, and a
 * `ready` with a different version after a reconnect (network drop, API restart, the stream's 15-minute cycle), also
 * re-read: an edit made before the stream opened or while it was down is not missed. Browser only; no credentials (the endpoint is anonymous).
 */
@Injectable({ providedIn: 'root' })
export class CatalogLive {
  private readonly url = `${inject(STORE_API_URL)}/catalog/events`;
  private readonly listeners = new Set<() => void>();
  private source: EventSource | null = null;
  private version: string | null = null;

  /** Calls `onChange` after every catalogue change until the returned function is called. */
  listen(onChange: () => void): () => void {
    this.listeners.add(onChange);
    this.open();
    return () => {
      this.listeners.delete(onChange);
      if (this.listeners.size === 0) this.close();
    };
  }

  private open(): void {
    if (this.source || typeof EventSource === 'undefined') return;
    const source = new EventSource(this.url);
    source.addEventListener('ready', (e) => this.seen((e as MessageEvent<string>).data, false));
    source.addEventListener('catalog', (e) => this.seen((e as MessageEvent<string>).data, true));
    this.source = source;
  }

  private close(): void {
    this.source?.close();
    this.source = null;
  }

  /** `ready`: re-read when this is the first answer (an edit may have landed between the page's refresh and the
   *  stream opening) or the version moved while disconnected; `catalog`: always. */
  private seen(version: string, changed: boolean): void {
    const missed = this.version !== version;
    this.version = version;
    if (changed || missed) for (const listener of [...this.listeners]) listener();
  }
}

/**
 * Re-reads the given resources whenever staff change the catalogue, for as long as the calling component lives.
 * Starts {@link CATALOG_LIVE_DELAY_MS} after the app is stable (after `refreshAfterHydration`'s refresh), browser only.
 * Call in an injection context (a page's constructor).
 */
export function reloadOnCatalogChange(...resources: Reloadable[]): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  const live = inject(CatalogLive);
  const app = inject(ApplicationRef);
  const destroyRef = inject(DestroyRef);
  let stop: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  destroyRef.onDestroy(() => {
    destroyed = true;
    clearTimeout(timer);
    stop?.();
  });
  afterNextRender(() => {
    void app.whenStable().then(() => {
      if (destroyed) return;
      timer = setTimeout(() => {
        stop = live.listen(() => {
          for (const resource of resources) resource.reload();
        });
      }, CATALOG_LIVE_DELAY_MS);
    });
  });
}
