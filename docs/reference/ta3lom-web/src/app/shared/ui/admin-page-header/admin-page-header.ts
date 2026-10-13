import { Component, input, output } from '@angular/core';
import { Button } from '../button/button';

/**
 * "h1 + description + [+ Add]" — docs/architecture/05-admin-shell.md's screen template, first
 * used verbatim in overview.css/media.css (Parts 1-2) and now extracted: Part 3 repeats it
 * across eight more screens, past the point duplicating a ~10-line CSS block was reasonable.
 */
@Component({
  selector: 'ta-admin-page-header',
  imports: [Button],
  templateUrl: './admin-page-header.html',
  styleUrl: './admin-page-header.css',
})
export class AdminPageHeader {
  readonly heading = input.required<string>();
  readonly description = input<string>();
  readonly addLabel = input<string>();
  readonly addDisabled = input(false);
  readonly add = output<void>();
}
