import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/** How long to wait for the observer before assuming it will never fire and showing anyway. */
const FAILSAFE_MS = 1200;

/**
 * The approved prototype's scroll reveal: content rises 24-28px and fades in as it enters the
 * viewport, once, never repeating. `stagger` mode delays each direct child in sequence so a grid
 * of cards arrives in a wave rather than all at once — the prototype marks those containers
 * `.rv-stagger` and plain elements `.rv` (ta3lom-prototype.html:320-324).
 *
 * The classes are added HERE, at runtime, never in a template. `.rv` starts at `opacity: 0`, and
 * this site is PRERENDERED (ADR-002): a class in the template would bake `opacity: 0` into the
 * static HTML, so anyone whose JavaScript fails, is blocked, or simply hasn't hydrated yet gets
 * a blank page — and e2e/prerender.spec.ts asserts real content is visible with
 * `javaScriptEnabled: false`.
 *
 * Everything below exists because of one rule: **content must never stay invisible.** An
 * animation that does not run is a cosmetic loss; content that never appears is a broken page.
 * So the hidden state is only ever entered when this code is also certain it can leave it, and
 * three independent paths clear it — the observer, a viewport sweep, and an unconditional
 * failsafe timer. Under `prefers-reduced-motion: reduce`, in a hidden tab (where
 * IntersectionObserver does not fire and layout is not measurable), or without
 * IntersectionObserver at all, nothing is hidden in the first place — non-negotiable #8.
 */
@Directive({
  selector: '[taReveal]',
})
export class Reveal {
  /** `true` staggers direct children (a card grid); `false` reveals the element as one block. */
  readonly stagger = input(false, { alias: 'taRevealStagger' });

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.reveal());
  }

  private reveal(): void {
    const element = this.elementRef.nativeElement;

    // A hidden document never fires IntersectionObserver and reports a zero-sized rect for
    // everything, so the reveal could not be undone — skip it and simply show the content.
    if (
      typeof IntersectionObserver === 'undefined' ||
      document.visibilityState === 'hidden' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    element.classList.add(this.stagger() ? 'rv-stagger' : 'rv');

    let done = false;
    const show = (): void => {
      if (done) return;
      done = true;
      element.classList.add('in');
      observer.disconnect();
      clearTimeout(failsafe);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) show();
        }
      },
      // Matches the prototype's own observer options.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    observer.observe(element);

    // Unconditional, not gated on a rect check: these grids are filled from httpResource, so an
    // element can be laid out and already on screen before it ever intersects anything, and a
    // backgrounded tab can swallow the callback entirely. Waiting to be *sure* it is on screen
    // is what would leave it invisible, so after a beat it simply shows. Below-the-fold content
    // still animates on scroll in the normal case, because the observer wins the race.
    const failsafe = setTimeout(show, FAILSAFE_MS);

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      clearTimeout(failsafe);
    });
  }
}
