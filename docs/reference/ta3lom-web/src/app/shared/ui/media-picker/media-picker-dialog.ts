import { Component, inject } from '@angular/core';
import { AssetRef } from '../../../core/admin-media.data';
import { I18nService } from '../../../core/i18n';
import { Dialog } from '../dialog/dialog';
import { MediaLibrary } from '../media-library/media-library';
import { MediaPickerService } from './media-picker.service';

/**
 * Rendered once, at the admin shell level — see MediaPickerService's header comment. Wraps
 * MediaLibrary in picker mode inside the shared Dialog primitive.
 */
@Component({
  selector: 'ta-media-picker-dialog',
  imports: [Dialog, MediaLibrary],
  templateUrl: './media-picker-dialog.html',
  styleUrl: './media-picker-dialog.css',
})
export class MediaPickerDialog {
  protected readonly picker = inject(MediaPickerService);
  protected readonly i18n = inject(I18nService);

  protected readonly title = this.i18n.pick('اختيار ملف', 'Select a file');
  protected readonly closeLabel = this.i18n.pick('إغلاق', 'Close');

  protected onPicked(asset: AssetRef): void {
    this.picker.resolve(asset);
  }

  protected onClosed(): void {
    this.picker.resolve(null);
  }
}
