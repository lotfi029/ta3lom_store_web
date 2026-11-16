import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';

/**
 * «تغييرات غير محفوظة في «…»» (docs/admin-redesign/02 §2, mockup D-Project): sticky above the editor while a section
 * has unsaved edits. It names the dirty sections; the page projects that section's Discard / Save buttons.
 */
@Component({
  selector: 'ta-save-bar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sb" role="region" [attr.aria-label]="label()">
      <p>
        <ta-icon name="alert" [size]="18" />
        <span>{{ message() }}</span>
      </p>
      <div class="acts"><ng-content /></div>
    </div>
  `,
  styles: `
    :host {
      position: sticky;
      inset-block-start: 56px;
      z-index: 20;
      display: block;
      margin-block: -24px 16px;
      margin-inline: calc(-1 * clamp(16px, 3vw, 40px));
    }
    .sb {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 16px;
      padding-block: 8px;
      padding-inline: clamp(16px, 3vw, 40px);
      background: var(--c-admin-topbar);
      color: var(--c-on-dark);
      border-block-start: 1px solid var(--c-border-on-dark);
    }
    p {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 0.9rem;
    }
    p ta-icon {
      color: var(--c-gold-on-dark);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    @media (width <= 640px) {
      :host {
        inset-block-start: 56px;
        margin-block-start: -16px;
        margin-inline: -12px;
      }
    }
  `,
})
export class SaveBar {
  readonly message = input.required<string>();
  readonly label = input.required<string>();
}
