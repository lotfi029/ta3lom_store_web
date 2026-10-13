import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n';

export type StatusPillState = 'published' | 'draft' | 'warning';

/**
 * "State is a pill: green منشور, grey مسودة. Rows that cannot be published ... carry an amber
 * pill saying which, so the editor sees the problem in the list rather than on save." —
 * docs/architecture/05-admin-shell.md. One component for every content screen's table.
 */
@Component({
  selector: 'ta-status-pill',
  templateUrl: './status-pill.html',
  styleUrl: './status-pill.css',
})
export class StatusPill {
  private readonly i18n = inject(I18nService);

  readonly state = input.required<StatusPillState>();
  /** Only meaningful for state="warning" — e.g. "no thumbnail". */
  readonly warningReason = input<string>();

  protected readonly label = computed(() => {
    switch (this.state()) {
      case 'published':
        return this.i18n.pick('منشور', 'Published');
      case 'warning':
        return this.warningReason() ?? this.i18n.pick('لا يمكن النشر', 'Cannot publish');
      default:
        return this.i18n.pick('مسودة', 'Draft');
    }
  });
}
