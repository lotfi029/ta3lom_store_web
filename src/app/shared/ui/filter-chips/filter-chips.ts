import { Component, input, output } from '@angular/core';

export interface FilterChipOption {
  value: string;
  label: string;
}

/**
 * Category filter chips shared by /programs and /videos (FR-10, FR-12). Real <button>
 * elements with aria-pressed, not the static <ta-chip> span — these are operable controls,
 * not labels.
 */
@Component({
  selector: 'ta-filter-chips',
  templateUrl: './filter-chips.html',
  styleUrl: './filter-chips.css',
})
export class FilterChips {
  readonly options = input.required<FilterChipOption[]>();
  readonly active = input.required<string>();
  /** The leading "all" chip; null leaves it out (the admin's section picker has no "all"). */
  readonly allLabel = input.required<string | null>();
  readonly ariaLabel = input.required<string>();
  readonly categorySelected = output<string>();
}
