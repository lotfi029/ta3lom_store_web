import { Component, DestroyRef, afterNextRender, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Image } from '../image/image';

export interface AccordionHeroItem {
  /** Stable identity for @for's track. Not the href: several cards can legitimately share a
   *  destination (every video card links to /videos, which has no per-video route), and
   *  duplicate track keys are a runtime error in Angular. */
  id: string;
  href: string;
  label: string;
  summary: string;
  imageSrc: string;
  imageAlt: string;
}

/**
 * Five linked cards (matching the prototype's `.acc .ac` anchors — this is a linked
 * carousel, not a content-hiding accordion, so no ARIA accordion role). The summary line
 * is visually hidden on inactive cards (CSS `max-height`/`opacity`), but nothing is removed
 * from the accessibility tree, and `select()` fires on both `mouseenter` and `focus`, so a
 * keyboard user sees the same reveal a mouse user does — no one is excluded.
 * Auto-advances every 3.8s, pauses on hover/focus, stops entirely under
 * prefers-reduced-motion.
 */
@Component({
  selector: 'ta-accordion-hero',
  imports: [RouterLink, Image],
  templateUrl: './accordion-hero.html',
  styleUrl: './accordion-hero.css',
})
export class AccordionHero {
  readonly items = input.required<AccordionHeroItem[]>();

  protected readonly activeIndex = signal(0);

  private readonly destroyRef = inject(DestroyRef);
  private timer?: ReturnType<typeof setInterval>;
  private paused = false;

  constructor() {
    afterNextRender(() => this.startAutoAdvance());
  }

  private startAutoAdvance(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    this.timer = setInterval(() => {
      if (!this.paused) {
        this.activeIndex.update((i) => (i + 1) % this.items().length);
      }
    }, 3800);
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
  }

  protected select(index: number): void {
    this.activeIndex.set(index);
  }

  protected pause(): void {
    this.paused = true;
  }

  protected resume(): void {
    this.paused = false;
  }
}
