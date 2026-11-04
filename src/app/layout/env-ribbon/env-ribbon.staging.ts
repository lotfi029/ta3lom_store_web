import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Staging ribbon "نسخة تجريبية · Staging" (owner brief P1). Swapped in for env-ribbon.ts by the `staging` build
 * configuration only. Fixed in a corner (no layout shift, no CLS), not interactive (pointer-events: none), bilingual
 * on purpose (it marks the environment, not content), high-contrast inverse colours.
 */
@Component({
  selector: 'ta-env-ribbon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="ribbon" role="note" lang="ar">
    نسخة تجريبية · <span lang="en">Staging</span>
  </p>`,
  styles: `
    .ribbon {
      position: fixed;
      inset-block-end: var(--space-3);
      inset-inline-start: var(--space-3);
      z-index: 1000;
      margin: 0;
      padding-block: var(--space-1);
      padding-inline: var(--space-3);
      border-radius: var(--rp);
      background: var(--c-inverse);
      color: var(--c-on-inverse);
      font-size: 0.8rem;
      font-weight: 700;
      pointer-events: none;
      box-shadow: var(--shadow-sm);
    }
  `,
})
export class EnvRibbon {}
