import { Injectable, signal } from '@angular/core';
import { AssetKind, AssetRef } from '../../../core/admin-media.data';

export interface MediaPickerOptions {
  filter?: AssetKind;
}

/**
 * Imperative pick() API, matching docs/architecture/05-admin-shell.md's ta-asset-picker
 * contract (`open(options): Promise<string | null>`) — here returning the full AssetRef rather
 * than just the id, since every caller in Parts 3-4 needs the asset's url/alt text immediately
 * (a thumbnail preview, an alt-text check) without a second round trip.
 *
 * ONE <ta-media-picker-dialog> is rendered once, at the admin shell level (like ta-toast at the
 * app root) and reads this service's state — callers never render a dialog themselves, they
 * just `await mediaPicker.pick({ filter: 'image' })`.
 */
@Injectable({ providedIn: 'root' })
export class MediaPickerService {
  readonly isOpen = signal(false);
  readonly filter = signal<AssetKind | undefined>(undefined);

  private resolver?: (value: AssetRef | null) => void;

  pick(options: MediaPickerOptions = {}): Promise<AssetRef | null> {
    // A picker opened while another is already pending resolves the earlier call with null
    // rather than leaving its promise dangling forever.
    this.resolver?.(null);

    this.filter.set(options.filter);
    this.isOpen.set(true);
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  resolve(asset: AssetRef | null): void {
    this.isOpen.set(false);
    // Benign today — the next pick() always overwrites this — but leaving a stale filter set
    // while the picker is closed is a latent trap for whatever reads `filter` next without
    // going through pick() first.
    this.filter.set(undefined);
    const resolve = this.resolver;
    this.resolver = undefined;
    resolve?.(asset);
  }
}
