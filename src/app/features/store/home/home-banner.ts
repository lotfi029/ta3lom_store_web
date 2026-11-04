import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Category, ProjectCard } from '../../../core/api/api.types';
import { I18nService } from '../../../core/i18n/i18n';
import { Icon } from '../../../shared/ui/icon/icon';
import { Image } from '../../../shared/ui/image/image';

/**
 * The cards the banner shows (Option C §2, §3 row 4): every `urgent` featured card, else the first featured card,
 * else none (no banner). Featured come from `GET /v1/catalog/home` in the API's order.
 */
export function bannerSlides(featured: readonly ProjectCard[]): ProjectCard[] {
  const urgent = featured.filter((c) => c.badge === 'urgent');
  if (urgent.length) return urgent;
  return featured.length ? [featured[0]] : [];
}

/**
 * Campaign banner (Option C §3 row 4, `--c-surface-indigo` with the brand glow): category label, the title — the
 * page's single `<h1>` —, summary and the "تبرع الآن" CTA → `/p/{slug}`. Several urgent cards: labelled previous/next
 * buttons and dots, NO auto-rotate; the change is announced in a polite live region. The cover is the LCP candidate
 * on wide screens (`priority` → eager, `fetchpriority=high`).
 */
@Component({
  selector: 'ta-home-banner',
  imports: [RouterLink, Icon, Image],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (slide(); as s) {
      <section class="banner" [attr.aria-label]="regionLabel">
        <div class="txt">
          @if (categoryName(s); as cat) {
            <span class="kicker">{{ cat }}</span>
          }
          <h1 class="t">{{ title(s) }}</h1>
          @if (summary(s); as sum) {
            <p class="sum">{{ sum }}</p>
          }
          <div class="row">
            <a class="cta" [routerLink]="['/p', s.slug]"
              ><span i18n="@@store.home.banner-cta">تبرع الآن</span
              ><span class="visually-hidden">: {{ title(s) }}</span></a
            >
            @if (slides().length > 1) {
              <div class="ctrl">
                <button
                  type="button"
                  class="nav prev"
                  (click)="go(index() - 1)"
                  aria-label="الحملة السابقة"
                  i18n-aria-label="@@store.home.banner-prev"
                >
                  <ta-icon name="chevron" [size]="18" />
                </button>
                <div class="dots">
                  @for (d of slides(); track d.id; let i = $index) {
                    <button
                      type="button"
                      class="dot"
                      [attr.aria-current]="i === index() ? 'true' : null"
                      [attr.aria-label]="dotLabel(i)"
                      (click)="go(i)"
                    >
                      <span class="pip" aria-hidden="true"></span>
                    </button>
                  }
                </div>
                <button
                  type="button"
                  class="nav next"
                  (click)="go(index() + 1)"
                  aria-label="الحملة التالية"
                  i18n-aria-label="@@store.home.banner-next"
                >
                  <ta-icon name="chevron" [size]="18" />
                </button>
              </div>
            }
          </div>
          <p class="visually-hidden" aria-live="polite">{{ announce() }}</p>
        </div>
        @if (s.coverUrl; as src) {
          <div class="media">
            <ta-image [src]="src" [alt]="alt(s)" [width]="600" [height]="400" [priority]="true" />
          </div>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      min-inline-size: 0;
    }
    .banner {
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-5);
      align-items: center;
      block-size: 100%;
      min-block-size: 260px;
      padding: var(--space-7);
      border-radius: var(--r-lg);
      background: var(--c-surface-indigo);
      color: var(--c-on-brand);
    }
    /* The brand glow sits on the media (end) side, never under the text (contrast in both directions). */
    .banner::before {
      content: '';
      position: absolute;
      inset-block-start: -40%;
      inset-inline-end: -15%;
      inline-size: 65%;
      block-size: 130%;
      background: radial-gradient(closest-side, var(--c-hero-glow-brand), transparent);
      pointer-events: none;
    }
    @media (width >= 900px) {
      .banner {
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
      }
    }
    @media (width < 600px) {
      .banner {
        padding: var(--space-5);
      }
    }
    .txt {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-inline-size: 0;
    }
    .kicker {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--c-gold-on-dark);
    }
    .t {
      margin: 0;
      font-size: clamp(1.6rem, 3.6vw, 2.4rem);
      line-height: 1.3;
      font-weight: 700;
      color: var(--c-on-brand);
    }
    .sum {
      margin: 0;
      color: var(--c-on-dark-78);
      font-size: 1rem;
      max-inline-size: 52ch;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3) var(--space-4);
      margin-block-start: var(--space-2);
    }
    .cta {
      display: inline-flex;
      align-items: center;
      min-block-size: 50px;
      padding-inline: var(--space-6);
      border-radius: var(--rp);
      background: var(--c-gold);
      color: var(--c-on-gold);
      font-weight: 700;
      text-decoration: none;
    }
    .cta:hover {
      box-shadow: var(--shadow-gold);
    }
    .cta:focus-visible,
    .nav:focus-visible,
    .dot:focus-visible {
      outline: 2px solid var(--c-on-brand);
      outline-offset: 2px;
    }
    .ctrl {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }
    .nav {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      border: 1px solid var(--c-border-on-dark-strong);
      background: none;
      color: var(--c-on-brand);
      cursor: pointer;
    }
    .nav:hover {
      background: var(--c-on-dark-hover);
    }
    /* chevron points to the reading end; "previous" turns it around. */
    .prev ta-icon {
      transform: scaleX(-1);
    }
    .dots {
      display: flex;
    }
    .dot {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 44px;
      border: 0;
      background: none;
      cursor: pointer;
    }
    .pip {
      inline-size: 8px;
      block-size: 8px;
      border-radius: var(--rp);
      background: var(--c-on-dark-65);
      transition: inline-size var(--dur-1);
    }
    .dot[aria-current='true'] .pip {
      inline-size: 22px;
      background: var(--c-on-brand);
    }
    .media {
      display: none;
      position: relative;
      z-index: 1;
      aspect-ratio: 3 / 2;
      border-radius: var(--rc);
      overflow: hidden;
      background: var(--c-dark-surface-edge);
    }
    @media (width >= 900px) {
      .media {
        display: block;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pip {
        transition: none;
      }
    }
  `,
})
export class HomeBanner {
  private readonly i18n = inject(I18nService);
  readonly featured = input.required<readonly ProjectCard[]>();
  readonly categories = input<readonly Category[]>([]);

  protected readonly slides = computed(() => bannerSlides(this.featured()));
  /** Resets to the first slide whenever the slide list changes, so a dot's aria-current always matches a slide (L-11). */
  protected readonly index = linkedSignal({
    source: () => this.slides().map((s) => s.id).join('|'),
    computation: () => 0,
  });
  protected readonly slide = computed(() => this.slides()[this.index()] ?? null);
  protected readonly announce = signal('');
  protected readonly regionLabel = $localize`:@@store.home.banner-label:حملات التبرع`;

  protected go(i: number): void {
    const n = this.slides().length;
    if (n < 2) return;
    const next = (i + n) % n;
    this.index.set(next);
    const s = this.slides()[next];
    this.announce.set(
      $localize`:@@store.home.banner-announce:الحملة ${next + 1}:n: من ${n}:total:: ${this.title(s)}:title:`,
    );
  }

  protected title(c: ProjectCard): string {
    return this.i18n.pick(c.titleAr, c.titleEn);
  }

  protected summary(c: ProjectCard): string {
    return this.i18n.pick(c.summaryAr ?? '', c.summaryEn);
  }

  protected alt(c: ProjectCard): string {
    return this.i18n.pick(c.coverAltAr ?? '', c.coverAltEn) || this.title(c);
  }

  protected categoryName(c: ProjectCard): string {
    const cat = this.categories().find((x) => x.slug === c.categorySlug);
    return cat ? this.i18n.pick(cat.nameAr, cat.nameEn) : '';
  }

  protected dotLabel(i: number): string {
    const n = i + 1;
    return $localize`:@@store.home.banner-dot:الحملة ${n}:n:`;
  }
}
