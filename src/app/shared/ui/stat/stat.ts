import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * Counts up from 0 to `value` once the element scrolls into view, then stops — never
 * repeats. Static (jumps straight to the final value) under prefers-reduced-motion.
 *
 * Or, with `text`, shows an editor-managed figure exactly as typed ("43K", "81٪") — no count-up.
 * Those strings are never parsed into numbers: "43K" is not 43, and guessing would misreport a
 * licensed non-profit's figures.
 */
@Component({
  selector: 'ta-stat',
  templateUrl: './stat.html',
  styleUrl: './stat.css',
})
export class Stat {
  readonly value = input<number>(0);
  /** A managed figure shown as-is; when set, `value` and the count-up are ignored. */
  readonly text = input<string | null>(null);
  readonly label = input.required<string>();
  readonly suffix = input('');
  readonly duration = input(1200);
  /** 'center' for home's stat cards; 'start' when the figure sits in a start-aligned sidebar
   *  (about/reports, about/beneficiaries) under a heading. */
  readonly align = input<'center' | 'start'>('center');

  protected readonly display = signal(0);

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;

  constructor() {
    afterNextRender(() => this.observe());
  }

  private observe(): void {
    if (this.text() !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.display.set(this.value());
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.started) {
            this.started = true;
            this.animate();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(this.elementRef.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private animate(): void {
    const target = this.value();
    const dur = this.duration();
    const start = performance.now();

    const step = (now: number): void => {
      const progress = Math.min((now - start) / dur, 1);
      this.display.set(Math.round(target * progress));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }
}
