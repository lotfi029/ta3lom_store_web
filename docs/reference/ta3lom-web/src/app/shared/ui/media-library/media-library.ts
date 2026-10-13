import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AdminAsset,
  AdminMediaData,
  AssetKind,
  AssetRef,
  AssetReference,
  AssetReferencesResponse,
  InUseErrorBody,
  MEDIA_PAGE_SIZE,
} from '../../../core/admin-media.data';
import { I18nService } from '../../../core/i18n';
import { ToastService } from '../../../core/toast.service';
import { assetKindLabel, assetLabel } from '../../util/asset-label';
import { validateMediaFile } from '../../util/media-validation';
import { youtubeIdFrom, youtubeThumbnailUrl } from '../../util/youtube-id';
import { AssetPreview } from '../asset-preview/asset-preview';
import { Button } from '../button/button';
import { Dialog } from '../dialog/dialog';

/**
 * The grid + upload + YouTube-add + alt dialog + delete, shared by /admin/media (features/admin
 * /media) and the picker dialog (shared/ui/media-picker) — docs/architecture/05-admin-shell.md:
 * "The library screen itself reuses the same grid, adding delete."
 *
 * FR-16 also asks for "search by original filename" — ta3lom-api's ListMediaDto (verified in
 * source, not assumed) has no search parameter at all, only `kind` and `missingAlt`. A
 * client-side filter over just the current loaded page would silently mislead an editor into
 * thinking an asset does not exist when it is simply on another page (ADR-007: ~150 assets at
 * launch, growing). Not built here — flagged as a real backend gap (`GET /admin/media?q=`)
 * rather than invented.
 */
@Component({
  selector: 'ta-media-library',
  imports: [AssetPreview, Button, Dialog, NgTemplateOutlet],
  templateUrl: './media-library.html',
  styleUrl: './media-library.css',
})
export class MediaLibrary {
  protected readonly data = inject(AdminMediaData);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  protected readonly Math = Math;
  protected readonly pageSize = MEDIA_PAGE_SIZE;

  readonly pickerMode = input(false);
  readonly fixedKindFilter = input<AssetKind | null>(null);
  readonly picked = output<AssetRef>();

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly dropOver = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly pendingAltAsset = signal<AssetRef | null>(null);
  protected readonly altAr = signal('');
  protected readonly altEn = signal('');
  protected readonly altSaving = signal(false);
  /** Save is already `[disabled]` while altAr is blank, so this guard is normally unreachable —
   *  it exists so a click that somehow gets through (a race, a future template change) shows the
   *  requirement instead of doing nothing (the button "appears broken", M9). */
  protected readonly altTouched = signal(false);

  protected readonly youtubeInput = signal('');
  protected readonly youtubeError = signal<string | null>(null);
  protected readonly youtubeAdding = signal(false);

  protected readonly deleteReferences = signal<{ asset: AssetRef; references: AssetReference[] } | null>(null);
  protected readonly deleting = signal(false);

  /**
   * The asset awaiting confirmation. Non-null opens the confirm dialog.
   *
   * These two signals are mutually exclusive by construction — never both non-null — because each
   * drives its own `<ta-dialog>`, and `ta-dialog` calls the native `showModal()`. Opening the
   * references dialog therefore clears this one first (see the IN_USE branch of confirmDelete).
   */
  protected readonly deleteTarget = signal<AssetRef | null>(null);

  /** Rendered inside the confirm dialog rather than as a toast: the dialog is where the editor is
   *  looking, and it stays open on failure so the message has somewhere to live. */
  protected readonly deleteError = signal<string | null>(null);

  /** Non-null opens the read-only preview dialog (ta-asset-preview) — the "عرض / View" action,
   *  only offered in library mode. A fourth dialog alongside alt/delete/references, so it gets
   *  the same mutual-exclusion treatment: opening it clears the other three (openPreview below),
   *  and the alt/delete triggers clear this one, so two `ta-dialog`s — each backed by a real
   *  `showModal()` — never end up open at once. */
  protected readonly previewAsset = signal<AdminAsset | null>(null);

  protected readonly previewDownloadUrl = computed<string | null>(() => {
    const asset = this.previewAsset();
    return asset ? this.data.fileDownloadUrl(asset.id) : null;
  });

  /** Null for a youtube asset, which has no file of its own to stream. See
   *  AdminMediaData.filePreviewUrl for why the PDF iframe uses this rather than asset.url. */
  protected readonly previewFileUrl = computed<string | null>(() => {
    const asset = this.previewAsset();
    return asset && asset.kind !== 'youtube' ? this.data.filePreviewUrl(asset.id) : null;
  });

  constructor() {
    // The picker can be opened scoped to one kind (e.g. "pick an image" for a thumbnail) — that
    // preset locks the underlying data filter too, not just the UI. `AdminMediaData` is
    // `providedIn: 'root'`, shared with the standalone /admin/media screen, so overriding its
    // filter here must be undone once the picker closes — otherwise picking a thumbnail leaves
    // /admin/media permanently stuck on "images" (M1, admin-dashboard-code-review.md). The
    // picker dialog renders this component behind `@if (picker.isOpen())`
    // (media-picker-dialog.html), so Angular destroys it — and runs this cleanup — on close.
    effect((onCleanup) => {
      const fixed = this.fixedKindFilter();
      if (!fixed) return;

      const previousKind = untracked(this.data.kindFilter);
      const previousPage = untracked(this.data.page);
      this.data.kindFilter.set(fixed);
      this.data.page.set(1);

      onCleanup(() => {
        this.data.kindFilter.set(previousKind);
        this.data.page.set(previousPage);
      });
    });
  }

  protected readonly kindLabels: Record<AssetKind, string> = {
    image: assetKindLabel('image', this.i18n),
    pdf: assetKindLabel('pdf', this.i18n),
    youtube: assetKindLabel('youtube', this.i18n),
  };

  // M13 (admin-dashboard-code-review.md): this used to say SVG was rejected outright. It was,
  // once — media-validation.ts and the API both accept it now (sanitised on write, ADR-008-
  // adjacent reasoning in media.service.ts), and the extension list here had also drifted from
  // media-validation.ts's actual IMAGE_EXTENSIONS (missing jpeg and svg).
  protected readonly dropHint = this.i18n.pick(
    'الصور: jpg, jpeg, png, webp, avif, svg — حتى 5 م.ب · PDF — حتى 10 م.ب.',
    'Images: jpg, jpeg, png, webp, avif, svg — up to 5 MB · PDF — up to 10 MB.',
  );
  protected readonly altRequiredHint = this.i18n.pick(
    'النص البديل بالعربية مطلوب — هذا ما يمنع الصور بلا وصف من الوصول إلى الموقع (المعيار F-17).',
    'Arabic alt text is required — this is what keeps images with no description off the site (finding F-17).',
  );

  protected setKindFilter(kind: AssetKind | 'all'): void {
    this.data.kindFilter.set(kind === 'all' ? null : kind);
    this.data.page.set(1);
  }

  protected toggleMissingAlt(checked: boolean): void {
    this.data.missingAltOnly.set(checked);
    this.data.page.set(1);
  }

  protected onDropOver(event: DragEvent): void {
    event.preventDefault();
    this.dropOver.set(true);
  }

  protected onDropLeave(): void {
    this.dropOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dropOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.startUpload(file);
  }

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.startUpload(file);
    if (this.fileInput()) this.fileInput()!.nativeElement.value = '';
  }

  private startUpload(file: File): void {
    this.uploadError.set(null);
    const validationError = validateMediaFile(file);
    if (validationError) {
      this.uploadError.set(this.i18n.pick(validationError.messageAr, validationError.messageEn));
      return;
    }

    this.uploadProgress.set(0);
    this.data.upload(file).subscribe({
      next: (event) => {
        if (event.kind === 'progress') {
          this.uploadProgress.set(event.percent);
        } else {
          this.uploadProgress.set(null);
          this.data.list.reload();
          if (event.asset.kind === 'image') {
            this.pendingAltAsset.set(event.asset);
            this.altAr.set('');
            this.altEn.set('');
            this.altTouched.set(false);
          } else if (this.pickerMode()) {
            this.picked.emit(event.asset);
          }
        }
      },
      error: (error: unknown) => {
        this.uploadProgress.set(null);
        this.uploadError.set(this.uploadErrorMessage(error));
      },
    });
  }

  /**
   * A 4xx here means the client's OWN file is the problem — rejected type/size (FILE_REJECTED)
   * or a request that somehow carried no file at all (VALIDATION_FAILED) — retrying the SAME
   * file cannot help, but a different one might. A 5xx, and STORAGE_UNAVAILABLE specifically
   * (media.service.ts's storageFailure — a filesystem write that failed, almost always
   * UPLOAD_DIR pointing somewhere unwritable after a redeploy), means the SERVER is broken and
   * no amount of retrying from here will fix it. Collapsing both into one "try again" message
   * (the previous behaviour) sent an editor into a retry loop against a server that could not
   * possibly succeed.
   */
  private uploadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = (error.error as { code?: string } | null)?.code;
      if (error.status < 500) {
        if (code === 'FILE_REJECTED') {
          return this.i18n.pick(
            'هذا الملف مرفوض — تحقّق من نوعه وحجمه، ثم جرّب ملفًا آخر.',
            'This file was rejected — check its type and size, then try a different file.',
          );
        }
        return this.i18n.pick(
          'تعذّر رفع هذا الملف. تحقّق منه ثم حاول مرة أخرى.',
          'Could not upload this file. Check it, then try again.',
        );
      }
      if (code === 'STORAGE_UNAVAILABLE') {
        return this.i18n.pick(
          'تعذّر حفظ الملف على الخادم. لن تفيد إعادة المحاولة — تواصل مع الدعم الفني.',
          'The server could not save the file. Retrying will not help — please contact support.',
        );
      }
    }
    return this.i18n.pick(
      'حدث خطأ غير متوقع أثناء الرفع. حاول مرة أخرى لاحقًا.',
      'Something went wrong during the upload. Please try again later.',
    );
  }

  protected async saveAlt(): Promise<void> {
    const asset = this.pendingAltAsset();
    if (!asset) return;
    if (!this.altAr().trim()) {
      this.altTouched.set(true);
      return;
    }
    this.altSaving.set(true);
    try {
      const updated = await this.data.updateAlt(asset.id, this.altAr().trim(), this.altEn().trim() || null);
      this.pendingAltAsset.set(null);
      if (this.pickerMode()) this.picked.emit(updated);
    } finally {
      this.altSaving.set(false);
    }
  }

  protected cancelAlt(): void {
    // The asset was already created (upload → alt → select is one flow, but the upload itself
    // already succeeded server-side) — cancelling only closes the dialog. The asset sits in the
    // library with altAr: null until an editor sets it from the grid, exactly like any other
    // image awaiting alt text (the "missing alt text" filter finds it).
    this.pendingAltAsset.set(null);
  }

  protected async addYoutube(): Promise<void> {
    this.youtubeError.set(null);
    const id = youtubeIdFrom(this.youtubeInput());
    if (!id) {
      this.youtubeError.set(
        this.i18n.pick(
          'الصق معرّف مقطع يوتيوب أو رابطه — لم يتم التعرف على معرّف صالح.',
          'Paste a YouTube video id or link — no valid id was recognised.',
        ),
      );
      return;
    }
    this.youtubeAdding.set(true);
    try {
      const asset = await this.data.registerYoutube(id);
      this.youtubeInput.set('');
      this.data.list.reload();
      if (this.pickerMode()) this.picked.emit(asset);
    } catch {
      this.youtubeError.set(this.i18n.pick('تعذّرت إضافة المقطع.', 'Could not add the video.'));
    } finally {
      this.youtubeAdding.set(false);
    }
  }

  protected onTileClick(asset: AssetRef): void {
    if (!this.pickerMode()) return;
    if (asset.kind === 'image' && !asset.altAr?.trim()) {
      // FR-35, enforced here too (the API enforces it again at publish time): an image with no
      // alt text cannot be selected. Opens the same alt dialog upload uses.
      this.pendingAltAsset.set(asset);
      this.altAr.set('');
      this.altEn.set('');
      this.altTouched.set(false);
      return;
    }
    this.picked.emit(asset);
  }

  protected openPreview(asset: AdminAsset): void {
    // See previewAsset's comment — keep the four dialogs mutually exclusive.
    this.pendingAltAsset.set(null);
    this.deleteTarget.set(null);
    this.deleteReferences.set(null);
    this.previewAsset.set(asset);
  }

  protected closePreview(): void {
    this.previewAsset.set(null);
  }

  protected async requestDelete(asset: AssetRef): Promise<void> {
    this.previewAsset.set(null);
    // Unguarded before — a failed reference check (network blip, an expired session) threw out
    // of this handler and the delete dialog simply never appeared, with nothing telling the
    // editor their click did anything (part of H1's pattern, applied here to a pre-flight check
    // rather than the delete itself).
    let refs: AssetReferencesResponse;
    try {
      refs = await this.data.getReferences(asset.id);
    } catch {
      this.toast.show(this.i18n.pick('تعذّر التحقق من استخدام هذا الملف.', 'Could not check whether this file is in use.'));
      return;
    }
    if (refs.total > 0) {
      this.deleteReferences.set({ asset, references: refs.references });
    } else {
      // Ask first. This used to delete on the spot, which made the single most destructive action
      // in the dashboard a one-click one: media.service.ts deletes the row and then unlinks the
      // file, so there is nothing left to restore. Every other admin screen confirms before
      // deleting a row; this one destroys a file on disk and did not.
      this.deleteError.set(null);
      this.deleteTarget.set(asset);
    }
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
    this.deleteError.set(null);
  }

  /** Reads `deleteTarget` rather than taking the asset as an argument, so the dialog's Delete
   *  button and this method cannot disagree about which asset is being removed. */
  protected async confirmDelete(): Promise<void> {
    const asset = this.deleteTarget();
    if (!asset) return;

    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.data.remove(asset.id);
      this.deleteTarget.set(null);
    } catch (error) {
      // A 409 can still happen on a race (something attached it between the references check
      // and the delete) — swap to the references dialog with the up-to-date list. Clearing
      // deleteTarget first keeps the two dialogs mutually exclusive (see the signal's comment).
      const body = (error as { error?: InUseErrorBody })?.error;
      if (body?.code === 'IN_USE') {
        this.deleteTarget.set(null);
        this.deleteReferences.set({ asset, references: body.references });
        return;
      }

      // Everything else — 5xx, an expired session, a dropped connection — used to land here and
      // do nothing at all: the spinner stopped, the dialog sat open, and the editor was told
      // nothing (the H1 pattern from the code review). Say so, and leave the dialog open to retry.
      this.deleteError.set(
        this.i18n.pick('تعذّر حذف الملف. حاول مرة أخرى.', 'Could not delete the file. Please try again.'),
      );
    } finally {
      this.deleting.set(false);
    }
  }

  protected closeReferences(): void {
    this.deleteReferences.set(null);
  }

  protected readonly youtubeThumbnail = youtubeThumbnailUrl;

  /** The literal `relation` values ta3lom-api's assetReferences() returns — verified against
   *  ta3lom-api/src/common/util/ref-counter.ts's actual return statements (its ASSET_RELATIONS
   *  constant, e.g. "programThumbs", is an unrelated internal DMMF-consistency-check name, not
   *  what reaches the client). Rendered here instead of the raw English word, which otherwise
   *  sits untranslated inside Arabic prose in the delete-references dialog. */
  private readonly relationLabels: Record<string, [string, string]> = {
    thumbnail: ['صورة مصغّرة', 'thumbnail'],
    logo: ['شعار', 'logo'],
    photo: ['صورة شخصية', 'photo'],
    file: ['ملف', 'file'],
    attachment: ['مرفق', 'attachment'],
    icon: ['أيقونة', 'icon'],
  };

  protected assetLabel(asset: AssetRef): string {
    return assetLabel(asset, this.i18n);
  }

  protected relationLabel(relation: string): string {
    const pair = this.relationLabels[relation];
    return pair ? this.i18n.pick(pair[0], pair[1]) : relation;
  }
}
