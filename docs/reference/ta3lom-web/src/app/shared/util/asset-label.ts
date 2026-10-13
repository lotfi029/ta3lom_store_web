import { AssetKind, AssetRef } from '../../core/admin-media.data';
import { I18nService } from '../../core/i18n';

/** Every admin surface that lists assets (the media grid, the attachments panel) needs the same
 *  fallback label, so it lives here rather than being reimplemented per component. */
export function assetKindLabel(kind: AssetKind, i18n: I18nService): string {
  return kind === 'image' ? i18n.pick('صورة', 'Image') : kind === 'pdf' ? 'PDF' : 'YouTube';
}

/**
 * aria-label on a tile suppresses all descendant text as its accessible name — for an asset with
 * no alt text, appending a distinguisher keeps a list of several PDFs/YouTube videos from all
 * announcing identically as just "PDF".
 *
 * `originalName` is optional in the parameter type, not required, because the plain `AssetRef`
 * shape (e.g. `attachments-panel.ts`'s attachment.asset) never carries it — only the admin
 * media library's `AdminAssetDto` does. When present it is the best distinguisher there is;
 * `externalId`/the uuid fragment are the fallbacks this had before that field existed.
 */
export function assetLabel(asset: AssetRef & { originalName?: string | null }, i18n: I18nService): string {
  if (asset.altAr) return i18n.pick(asset.altAr, asset.altEn);
  const distinguisher = asset.originalName ?? asset.externalId ?? asset.id.slice(0, 8);
  return `${assetKindLabel(asset.kind, i18n)} — ${distinguisher}`;
}
