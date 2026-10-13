import { Component, computed, inject, input, output } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { AdminAsset } from '../../../core/admin-media.data';
import { TrustedFrameUrl } from '../../../core/trusted-frame-url';
import { I18nService } from '../../../core/i18n';
import { assetKindLabel, assetLabel } from '../../util/asset-label';
import { formatBytes } from '../../util/format-bytes';
import { youtubeThumbnailUrl } from '../../util/youtube-id';
import { Dialog } from '../dialog/dialog';

/**
 * Read-only "view this asset" dialog for the media library — non-negotiable #1's `.tile`
 * collision fix made the Delete/Alt-text row visible again, but there was still no way to see an
 * image full-size (only a cropped 4:3 thumbnail) or tell which PDF an asset even was (just the
 * word "PDF" in a grey box). Mirrors video-modal.ts, the only other "media in a modal" component:
 * close button first in DOM order, iframe built only while open.
 *
 * Presentational only, per shared/ui's rule — `downloadUrl` is composed by the caller
 * (media-library.ts already injects AdminMediaData for the rest of the grid) rather than this
 * component reaching for a data service itself, the same split `ta-doc-list` keeps from its
 * callers' `documentFileUrl()`.
 */
@Component({
  selector: 'ta-asset-preview',
  imports: [Dialog],
  templateUrl: './asset-preview.html',
  styleUrl: './asset-preview.css',
})
export class AssetPreview {
  private readonly frames = inject(TrustedFrameUrl);
  protected readonly i18n = inject(I18nService);

  readonly asset = input<AdminAsset | null>(null);
  /** Null while `asset()` is null; the caller builds it from `AdminMediaData.fileDownloadUrl`. */
  readonly downloadUrl = input<string | null>(null);
  /** The iframe src for a PDF, from `AdminMediaData.filePreviewUrl` — see that method for why the
   *  preview deliberately does not frame `asset.url`. Falls back to `asset.url` when absent so the
   *  component still renders standalone. */
  readonly fileUrl = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly open = computed(() => this.asset() !== null);

  /** Null for anything that isn't a PDF with an allowed url — the template's `@if` on this is what
   *  keeps the iframe from ever being created for an image/YouTube asset or a malformed url.
   *  core/trusted-frame-url.ts is the check: only the API's own file endpoints are frameable
   *  (media-library always passes `fileUrl`, built from API_URL). */
  protected readonly trustedPdfUrl = computed<SafeResourceUrl | null>(() => {
    const asset = this.asset();
    if (asset?.kind !== 'pdf' || !asset.url) return null;
    return this.frames.trust(this.fileUrl() ?? asset.url);
  });

  protected readonly youtubeThumbnail = youtubeThumbnailUrl;
  protected readonly formatBytes = formatBytes;

  protected onClosed(): void {
    this.closed.emit();
  }

  protected label(asset: AdminAsset): string {
    return assetLabel(asset, this.i18n);
  }

  protected kindLabel(asset: AdminAsset): string {
    return assetKindLabel(asset.kind, this.i18n);
  }
}

