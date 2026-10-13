import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Prototype "مشاركة": the system share sheet where the browser has one (phones), otherwise a dialog with WhatsApp,
 * X and copy-link. Nothing is loaded from a third party; the links open in a new tab.
 */
@Component({
  selector: 'ta-share-sheet',
  imports: [Dialog, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="share-btn" (click)="share()">
      <ta-icon name="share" [size]="16" /><span i18n="@@store.share.button">مشاركة</span>
    </button>
    <ta-dialog [(open)]="open" labelledBy="share-h">
      <div class="sheet">
        <div class="hd">
          <h2 id="share-h" i18n="@@store.share.title">مشاركة المنتج</h2>
          <button type="button" class="x" (click)="open.set(false)" aria-label="إغلاق" i18n-aria-label="@@store.ui.toast-dismiss"><ta-icon name="close" [size]="20" /></button>
        </div>
        <ul class="ways">
          <li><a [href]="whatsapp()" target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
          <li><a [href]="xUrl()" target="_blank" rel="noopener noreferrer">X</a></li>
          <li>
            <button type="button" (click)="copy()"><ta-icon name="copy" [size]="18" /><span i18n="@@store.share.copy">نسخ الرابط</span></button>
          </li>
        </ul>
      </div>
    </ta-dialog>
  `,
  styles: `
    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 44px;
      padding-inline: 14px;
      border-radius: var(--rp);
      border: 1px solid var(--c-border);
      background: var(--c-surface);
      color: var(--c-text);
      font: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .share-btn:hover {
      border-color: var(--c-text);
    }
    .sheet {
      background: var(--c-surface);
      color: var(--c-text);
      inline-size: min(420px, 92vw);
    }
    .hd {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-block: 14px;
      padding-inline: 20px;
      border-block-end: 1px solid var(--c-border);
    }
    .hd h2 {
      font-size: 1.1rem;
      margin: 0;
    }
    .x {
      inline-size: 44px;
      block-size: 44px;
      border: 0;
      background: none;
      color: var(--c-muted);
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .ways {
      list-style: none;
      margin: 0;
      padding: 16px 20px 20px;
      display: grid;
      gap: 8px;
    }
    .ways a,
    .ways button {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      min-block-size: 48px;
      padding-inline: 16px;
      border-radius: 12px;
      border: 1px solid var(--c-border);
      background: var(--c-surface);
      color: var(--c-text);
      text-decoration: none;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    .ways a:hover,
    .ways button:hover {
      border-color: var(--c-text);
    }
  `,
})
export class ShareSheet {
  private readonly toast = inject(ToastService);
  readonly url = input.required<string>();
  readonly title = input.required<string>();
  protected readonly open = signal(false);
  protected readonly whatsapp = computed(() => `https://wa.me/?text=${encodeURIComponent(`${this.title()} ${this.url()}`)}`);
  protected readonly xUrl = computed(() => `https://x.com/intent/post?text=${encodeURIComponent(this.title())}&url=${encodeURIComponent(this.url())}`);

  protected async share(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: this.title(), url: this.url() });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    this.open.set(true);
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.toast.show($localize`:@@store.share.copied:نُسخ الرابط.`, 'success');
    } catch {
      this.toast.show(this.url());
    }
    this.open.set(false);
  }
}
