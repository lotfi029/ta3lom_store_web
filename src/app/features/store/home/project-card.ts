import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProjectCard as Card } from '../../../core/api/api.types';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Image } from '../../../shared/ui/image/image';
import { Money } from '../../../shared/ui/money/money';
import { DonateBox } from '../donate/donate-box';
import type { DonateProject } from '../donate/donate-draft';
import { ProjectData } from '../donate/project.data';
import { ShareBar } from '../share/share-bar';

/**
 * The project card (D-W5, reference card): image with a fixed ratio (lazy, alt from the API) and the share bar, title
 * linking to `/p/{slug}`, one-line summary, then the donate box (option chips → qty stepper, "تبرع مفتوح" → amount,
 * اضافة / تبرع). No progress bar. A project with options loads them from its detail (the card DTO has none).
 */
@Component({
  selector: 'ta-project-card',
  imports: [RouterLink, Image, Money, DonateBox, ShareBar],
  providers: [ProjectData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="pcard" [attr.aria-labelledby]="'pc-' + project().id">
      <div class="media">
        @if (project().coverUrl; as src) {
          <ta-image [src]="src" [alt]="alt()" [width]="800" [height]="500" imgClass="cover" />
        } @else {
          <div class="cover ph" aria-hidden="true"></div>
        }
        @if (project().badge === 'urgent') {
          <span class="ribbon tag gold" i18n="@@store.card.badge-urgent">عاجل</span>
        } @else if (project().badge === 'new') {
          <span class="ribbon tag green" i18n="@@store.card.badge-new">جديد</span>
        }
      </div>
      <ta-share-bar [url]="url()" [title]="title()" />
      @if (headingLevel() === 2) {
        <h2 class="t" [id]="'pc-' + project().id">
          <a [routerLink]="['/p', project().slug]">{{ title() }}</a>
        </h2>
      } @else {
        <h3 class="t" [id]="'pc-' + project().id">
          <a [routerLink]="['/p', project().slug]">{{ title() }}</a>
        </h3>
      }
      @if (summary()) {
        <p class="sum">{{ summary() }}</p>
      }
      @if (project().fromAmount; as from) {
        <p class="from">
          <span i18n="@@store.card.from">يبدأ من</span> <ta-money [value]="from" />
        </p>
      }
      <ta-donate-box [project]="donate()" [idPrefix]="'c-' + project().slug" />
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .pcard {
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: var(--rc);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      block-size: 100%;
    }
    .media {
      position: relative;
      aspect-ratio: 16 / 10;
      border-radius: 12px;
      overflow: hidden;
      background: var(--c-surface-2);
    }
    .media ::ng-deep .cover,
    .cover {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .ribbon {
      position: absolute;
      inset-block-start: 10px;
      inset-inline-start: 10px;
    }
    .t {
      font-size: 1.04rem;
      line-height: 1.4;
      margin: 0;
    }
    .t a {
      color: inherit;
      text-decoration: none;
    }
    .t a:hover {
      color: var(--c-link);
      text-decoration: underline;
    }
    .sum {
      margin: 0;
      font-size: 0.86rem;
      color: var(--c-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .from {
      display: flex;
      gap: 4px;
      align-items: baseline;
      margin: 0;
      font-size: 0.82rem;
      color: var(--c-muted);
    }
    ta-donate-box {
      margin-block-start: auto;
    }
  `,
})
export class ProjectCard implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly data = inject(ProjectData);
  readonly project = input.required<Card>();
  readonly headingLevel = input<2 | 3>(3);

  protected readonly title = computed(() =>
    this.i18n.pick(this.project().titleAr, this.project().titleEn),
  );
  protected readonly summary = computed(() =>
    this.i18n.pick(this.project().summaryAr ?? '', this.project().summaryEn),
  );
  protected readonly alt = computed(() => this.project().coverAltAr || this.title());
  protected readonly url = computed(() =>
    this.seo.url(this.i18n.locale, `/p/${this.project().slug}`),
  );
  /** Options: none when the card says there are none (`fromAmount` null), else from the detail (null = loading). */
  protected readonly donate = computed<DonateProject>(() => {
    const p = this.project();
    const detail = this.data.detail();
    return {
      id: p.id,
      slug: p.slug,
      titleAr: p.titleAr,
      titleEn: p.titleEn,
      allowOpenAmount: p.allowOpenAmount,
      minAmount: p.minAmount,
      options:
        p.fromAmount === null
          ? []
          : detail
            ? detail.options
            : this.data.resource.error()
              ? []
              : null,
    };
  });

  ngOnInit(): void {
    if (this.project().fromAmount !== null) this.data.slug.set(this.project().slug);
  }
}
