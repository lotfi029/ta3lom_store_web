import { Component, input } from '@angular/core';

export type PillTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

/** A status as a pill (prototype `.pill`): order, project and donor states. The label is projected. */
@Component({
  selector: 'ta-status-pill',
  template: '<span class="pill" [class]="tone()"><ng-content /></span>',
  styleUrl: './status-pill.css',
})
export class StatusPill {
  readonly tone = input<PillTone>('neutral');
}
