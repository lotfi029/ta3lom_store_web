import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ToastService } from '../../../core/ui/toast.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { shareLinks } from './share-links';

/**
 * The card's share bar (D-W5, reference card): WhatsApp, X, Facebook, copy link and — where the browser has one — the
 * system share sheet. Icon buttons of 44 × 44 px, each with an accessible name that includes the project title.
 */
@Component({
  selector: 'ta-share-bar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="share-list" [attr.aria-label]="groupLabel()">
      <li>
        <a
          [href]="links().whatsapp"
          target="_blank"
          rel="noopener noreferrer"
          [attr.aria-label]="label('WhatsApp')"
          ><ta-icon name="whatsapp" [size]="18"
        /></a>
      </li>
      <li>
        <a
          [href]="links().x"
          target="_blank"
          rel="noopener noreferrer"
          [attr.aria-label]="label('X')"
          ><ta-icon name="xlogo" [size]="18"
        /></a>
      </li>
      <li>
        <a
          [href]="links().facebook"
          target="_blank"
          rel="noopener noreferrer"
          [attr.aria-label]="label('Facebook')"
          ><ta-icon name="facebook" [size]="18"
        /></a>
      </li>
      <li>
        <button type="button" (click)="copy()" [attr.aria-label]="copyLabel()">
          <ta-icon name="link" [size]="18" />
        </button>
      </li>
      @if (canShare) {
        <li>
          <button type="button" (click)="native()" [attr.aria-label]="nativeLabel()">
            <ta-icon name="share" [size]="18" />
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    .share-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    a,
    button {
      inline-size: 44px;
      block-size: 44px;
      display: grid;
      place-items: center;
      border-radius: var(--rp);
      border: 1px solid var(--c-border);
      background: var(--c-surface);
      color: var(--c-text-2);
      cursor: pointer;
    }
    a:hover,
    button:hover {
      border-color: var(--c-text);
      color: var(--c-text);
    }
  `,
})
export class ShareBar {
  private readonly toast = inject(ToastService);
  readonly url = input.required<string>();
  readonly title = input.required<string>();
  protected readonly links = computed(() => shareLinks(this.url(), this.title()));
  protected readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  protected readonly groupLabel = computed(
    () => $localize`:@@store.share.bar-label:مشاركة ${this.title()}:title:`,
  );
  protected readonly copyLabel = computed(
    () => $localize`:@@store.share.copy-for:نسخ رابط ${this.title()}:title:`,
  );
  protected readonly nativeLabel = computed(
    () => $localize`:@@store.share.native-for:مشاركة ${this.title()}:title: عبر الجهاز`,
  );

  protected label(network: string): string {
    return $localize`:@@store.share.on-network:مشاركة ${this.title()}:title: على ${network}:network:`;
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.toast.show($localize`:@@store.share.copied:نُسخ الرابط.`, 'success');
    } catch {
      this.toast.show(this.url());
    }
  }

  protected async native(): Promise<void> {
    try {
      await navigator.share({ title: this.title(), url: this.url() });
    } catch {
      /* cancelled */
    }
  }
}
