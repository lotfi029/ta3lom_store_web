import { Component, input } from '@angular/core';

/**
 * Must be the first focusable element on every route — visually hidden until focused.
 * `targetId` defaults to "main" (the public layout's landmark id); the admin shell's own
 * landmark is "admin-main", so it passes that explicitly (Session 2, Part 1 a11y-auditor
 * finding: the admin shell had no skip link at all).
 */
@Component({
  selector: 'ta-skip-link',
  templateUrl: './skip-link.html',
  styleUrl: './skip-link.css',
})
export class SkipLink {
  readonly targetId = input('main');
}
