import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProjectCard as Card } from '../../../core/api/api.types';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Image } from '../../../shared/ui/image/image';
import { DonateBox } from '../donate/donate-box';
import type { DonateProject } from '../donate/donate-draft';
import { ShareSheet } from '../share/share-sheet';

/**
 * The compact project card (Option C §4, D-W5; Option D look): image 4:3 (lazy, alt from the API) with the badge at
 * the top start corner and an icon share button (spec C-1, REVIEW) at the top end; the category name and the title
 * linking to `/p/{slug}` on a glass plate over the photo; a 2-line summary; then the donate box (option chips + "تبرع مفتوح" → qty stepper or amount, تبرع /
 * اضافة). No progress bar. Options come with the card (`ProjectCard.options`, API-9) — no request per card.
 */
@Component({
  selector: 'ta-project-card',
  imports: [RouterLink, Image, DonateBox, ShareSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="pcard" [attr.aria-labelledby]="'pc-' + project().id">
      <div class="media">
        @if (project().coverUrl; as src) {
          <ta-image [src]="src" [alt]="alt()" [width]="600" [height]="400" />
        } @else {
          <div class="cover ph" aria-hidden="true"></div>
        }
        <!-- Option D: the badge floats at the top; the category and title sit on a glass plate over the photo. -->
        <div class="chips">
          @if (project().badge === 'urgent') {
            <span class="badge" i18n="@@store.card.badge-urgent">عاجل</span>
          } @else if (project().badge === 'new') {
            <span class="badge" i18n="@@store.card.badge-new">جديد</span>
          }
        </div>
        <div class="share"><ta-share-sheet [url]="url()" [title]="title()" [compact]="true" /></div>
        <div class="plate">
          @if (categoryName()) {
            <span class="cat">{{ categoryName() }}</span>
          }
          @if (headingLevel() === 2) {
            <h2 class="t" [id]="'pc-' + project().id">
              <a [routerLink]="['/p', project().slug]">{{ title() }}</a>
            </h2>
          } @else {
            <h3 class="t" [id]="'pc-' + project().id">
              <a [routerLink]="['/p', project().slug]">{{ title() }}</a>
            </h3>
          }
        </div>
      </div>
      <div class="body">
        @if (summary()) {
          <p class="sum">{{ summary() }}</p>
        }
        <ta-donate-box [project]="donate()" [idPrefix]="'c-' + project().slug" />
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
      block-size: 100%;
    }
    .pcard {
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: var(--rc);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      block-size: 100%;
      transition:
        transform var(--dur-2) var(--ease),
        box-shadow var(--dur-2) var(--ease);
    }
    @media (hover: hover) {
      .pcard:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-md);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pcard,
      .pcard:hover {
        transition: none;
        transform: none;
      }
    }
    .media {
      position: relative;
      aspect-ratio: 4 / 3;
      background: var(--c-tint);
    }
    .media ta-image,
    .cover {
      position: absolute;
      inset: 0;
    }
    .cover {
      inline-size: 100%;
      block-size: 100%;
      display: block;
    }
    .chips {
      position: absolute;
      inset-block-start: var(--space-3);
      inset-inline-start: var(--space-3);
      inset-inline-end: calc(var(--space-3) + 48px);
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      align-items: flex-start;
    }
    .badge {
      padding-block: 2px;
      padding-inline: var(--space-3);
      border-radius: var(--rp);
      background: var(--c-gold);
      color: var(--c-on-gold);
      font-size: 0.75rem;
      font-weight: 700;
    }
    .share {
      position: absolute;
      inset-block-start: var(--space-2);
      inset-inline-end: var(--space-2);
    }
    .body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-4);
    }
    /* The plate grows upward from the bottom of the photo, so a long title never leaves the image. */
    /* The dense dark plate without backdrop-filter: one blur per card was the costliest paint on the page (CI TBT);
       at 78 % the photo barely shows through anyway. Contrast: contrast-check "plate … over a photo". */
    .plate {
      background: var(--c-glass-plate);
      border: 1px solid var(--c-glass-plate-edge);
      box-shadow: inset 0 1px 0 var(--c-glass-dark-highlight);
      color: var(--c-on-brand);
      position: absolute;
      inset-inline: var(--space-2);
      inset-block-end: var(--space-2);
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-block: var(--space-2);
      padding-inline: var(--space-4);
      border-radius: var(--r-lg);
    }
    .cat {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--c-on-dark-78);
    }
    .t {
      font-size: 1rem;
      line-height: 1.5;
      font-weight: 700;
      margin: 0;
    }
    .t a {
      color: var(--c-on-brand);
      text-decoration: none;
    }
    .t a:hover {
      text-decoration: underline;
    }
    .t a:focus-visible {
      outline: 2px solid var(--c-on-brand);
      outline-offset: 2px;
    }
    .sum {
      margin: 0;
      font-size: 0.875rem;
      color: var(--c-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    ta-donate-box {
      margin-block-start: auto;
      padding-block-start: var(--space-2);
    }
  `,
})
export class ProjectCard {
  private readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  readonly project = input.required<Card>();
  readonly headingLevel = input<2 | 3>(3);
  /** The category's name (from `/catalog/categories`, looked up by the page — no request per card). */
  readonly categoryName = input('');

  protected readonly title = computed(() =>
    this.i18n.pick(this.project().titleAr, this.project().titleEn),
  );
  protected readonly summary = computed(() =>
    this.i18n.pick(this.project().summaryAr ?? '', this.project().summaryEn),
  );
  /** Alt from the API (API-10: English from `coverAltEn`), Arabic as the fallback, the title when there is none. */
  protected readonly alt = computed(() => {
    const p = this.project();
    return this.i18n.pick(p.coverAltAr ?? '', p.coverAltEn) || this.title();
  });
  protected readonly url = computed(() =>
    this.seo.url(this.i18n.locale, `/p/${this.project().slug}`),
  );
  protected readonly donate = computed<DonateProject>(() => {
    const p = this.project();
    return {
      id: p.id,
      slug: p.slug,
      titleAr: p.titleAr,
      titleEn: p.titleEn,
      allowOpenAmount: p.allowOpenAmount,
      minAmount: p.minAmount,
      options: p.options,
    };
  });
}
