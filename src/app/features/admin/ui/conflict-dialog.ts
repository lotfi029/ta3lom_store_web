import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { Dialog } from '../../../shared/ui/dialog/dialog';

/**
 * 409 `concurrency.conflict` (someone saved the same record since it was loaded — the `version` no longer matches):
 * load the latest version (this form's edits are dropped) or go back to the form, e.g. to copy text out first.
 */
@Component({
  selector: 'ta-conflict-dialog',
  imports: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ta-dialog [(open)]="open" [labelledBy]="idPrefix() + '-h'" [lightDismiss]="false">
      <div class="dlg" role="alertdialog" [attr.aria-describedby]="idPrefix() + '-d'">
        <h2 [id]="idPrefix() + '-h'" i18n="@@store.admin.conflict-title">تغيّرت البيانات</h2>
        <p [id]="idPrefix() + '-d'" i18n="@@store.admin.conflict-lede">
          حفظ شخص آخر تعديلات على هذا السجل بعد أن فتحته. حمّل النسخة الأحدث ثم أعد تعديلك، أو ارجع
          إلى النموذج لتنسخ ما كتبت أولًا.
        </p>
        <div class="acts">
          <button
            type="button"
            class="btn primary"
            (click)="reload.emit(); open.set(false)"
            i18n="@@store.admin.conflict-reload"
          >
            تحميل النسخة الأحدث
          </button>
          <button
            type="button"
            class="btn"
            (click)="open.set(false)"
            i18n="@@store.admin.conflict-back"
          >
            الرجوع إلى النموذج
          </button>
        </div>
      </div>
    </ta-dialog>
  `,
  styleUrls: ['../admin-common.css'],
})
export class ConflictDialog {
  readonly open = model(false);
  readonly idPrefix = input('cf');
  readonly reload = output<void>();
}
