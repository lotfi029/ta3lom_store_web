import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ProjectCard as Card, ProjectDetail } from './core/api/api.types';
import { STORE_API_URL } from './core/api/store-api-url';
import { StoreAuth } from './core/auth/store-auth';
import { QuickDonate } from './core/ui/quick-donate.service';
import { HomeBanner } from './features/store/home/home-banner';
import { ProjectCard } from './features/store/home/project-card';
import { ProjectPage } from './features/store/project/project.page';
import { projectJsonLd } from './features/store/project/project-seo';
import { Footer } from './layout/footer/footer';
import { Header } from './layout/header/header';
import { SHOWCASE } from './core/showcase/showcase';

/** SW-2 / SW-7: what donors see in showcase mode (and that live mode is unchanged). */
const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));
const NOTE_AR = 'التبرع الإلكتروني قريبًا';
const CARD: Card = {
  id: 'p1',
  slug: 'water-wells',
  titleAr: 'سقيا الماء',
  titleEn: 'Water wells',
  summaryAr: 'ملخص',
  summaryEn: null,
  coverUrl: null,
  coverAltAr: null,
  coverAltEn: null,
  badge: null,
  categorySlug: 'relief',
  allowOpenAmount: true,
  minAmount: '10.00',
  fromAmount: '250.00',
  options: [
    { id: 'o1', labelAr: 'نصف بئر', labelEn: 'Half a well', amount: '250.00' },
    { id: 'o2', labelAr: 'بئر', labelEn: 'A well', amount: '500.00' },
  ],
};
const DETAIL = {
  ...CARD,
  status: 'published',
  bodyAr: 'نص',
  bodyEn: null,
  category: { id: 'c1', slug: 'relief', nameAr: 'الإغاثة', nameEn: 'Relief' },
  seoTitleAr: null,
  seoTitleEn: null,
  seoDescAr: null,
  seoDescEn: null,
  publishedAt: null,
} as unknown as ProjectDetail;

function configure(showcase: boolean, locale = 'ar', extra: unknown[] = []) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: STORE_API_URL, useValue: API },
      { provide: LOCALE_ID, useValue: locale },
      { provide: SHOWCASE, useValue: showcase },
      ...(extra as never[]),
    ],
  });
}

function card(showcase: boolean, locale = 'ar') {
  configure(showcase, locale);
  const f = TestBed.createComponent(ProjectCard);
  f.componentRef.setInput('project', CARD);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('showcase mode', () => {
  describe('project card (SW-2)', () => {
    it('showcase: options and prices read only — no chips, stepper, amount field or buttons — and the note', () => {
      const el = card(true);
      const box = el.querySelector('ta-donate-box')!;
      expect(box.querySelectorAll('input, button, ta-qty-stepper, ta-amount-input')).toHaveLength(0);
      expect(box.textContent).toContain('نصف بئر');
      expect(box.textContent).toContain('250');
      expect(box.textContent).toContain('500');
      expect(box.querySelector('[role=note]')?.textContent).toContain(NOTE_AR);
    });

    it('showcase (en): the English note', () => {
      expect(card(true, 'en').querySelector('[role=note]')?.textContent).toContain(NOTE_AR); // source text in unit tests
    });

    it('live: the chips and the two buttons, no note', () => {
      const el = card(false);
      expect(el.querySelectorAll('ta-donate-box input[type=radio]')).toHaveLength(3);
      expect(el.querySelectorAll('.acts button')).toHaveLength(2);
      expect(el.querySelector('[role=note]')).toBeNull();
    });
  });

  describe('project page (SW-2)', () => {
    async function page(showcase: boolean) {
      configure(showcase);
      const f = TestBed.createComponent(ProjectPage);
      f.componentRef.setInput('slug', 'water-wells');
      f.detectChanges();
      TestBed.tick();
      TestBed.inject(HttpTestingController).expectOne(`${API}/catalog/projects/water-wells`).flush(DETAIL);
      await tick();
      f.detectChanges();
      return f.nativeElement as HTMLElement;
    }

    it('showcase: the options read only, the note, no sticky donate bar', async () => {
      const el = await page(true);
      expect(el.querySelectorAll('.buybox input, .buybox button')).toHaveLength(0);
      expect(el.querySelector('.buybox')?.textContent).toContain('بئر');
      expect(el.querySelector('.buybox [role=note]')?.textContent).toContain(NOTE_AR);
      expect(el.querySelector('.dbar')).toBeNull();
    });

    it('live: the donate box keeps its controls', async () => {
      const el = await page(false);
      expect(el.querySelectorAll('.buybox input[type=radio]').length).toBeGreaterThan(0);
      expect(el.querySelector('.buybox [role=note]')).toBeNull();
    });
  });

  describe('header and footer (SW-2)', () => {
    function header(showcase: boolean) {
      const ensureSession = vi.fn(() => Promise.resolve(false));
      configure(showcase, 'ar', [
        { provide: StoreAuth, useValue: { ensureSession, isSignedIn: () => false } },
      ]);
      TestBed.inject(QuickDonate).giftCategoryCount.set(3);
      const f = TestBed.createComponent(Header);
      f.detectChanges();
      return { el: f.nativeElement as HTMLElement, ensureSession };
    }

    it('showcase: no cart, sign-in/account or quick-donate entry (desktop and mobile), no session restore', async () => {
      const { el, ensureSession } = header(true);
      await tick();
      expect(el.querySelector('a[href="/cart"], a[href="/login"], a[href="/account/donations"]')).toBeNull();
      expect(el.querySelector('.cartbtn, .signin, button.quick')).toBeNull();
      expect(ensureSession).not.toHaveBeenCalled();
    });

    it('live: the cart, sign-in and quick-donate entries are there', () => {
      const { el } = header(false);
      expect(el.querySelector('a.cartbtn')).not.toBeNull();
      expect(el.querySelector('a.signin')).not.toBeNull();
      expect(el.querySelector('button.quick')).not.toBeNull();
    });

    it('showcase: the footer has no cart or donations link', () => {
      configure(true);
      const f = TestBed.createComponent(Footer);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('a[href="/cart"], a[href="/account/donations"]')).toBeNull();
      expect(el.querySelector('a[href="/#projects"]')).not.toBeNull();
    });
  });

  describe('home banner (SW-2)', () => {
    const cta = (showcase: boolean) => {
      configure(showcase);
      const f = TestBed.createComponent(HomeBanner);
      f.componentRef.setInput('featured', [{ ...CARD, badge: 'urgent' }]);
      f.detectChanges();
      return (f.nativeElement as HTMLElement).querySelector('a.cta')?.textContent ?? '';
    };

    it('showcase: the slide links to the project without a "donate now" promise', () => {
      const text = cta(true);
      expect(text).toContain('تعرّف على المشروع');
      expect(text).not.toContain('تبرع الآن');
    });

    it('live: "donate now"', () => expect(cta(false)).toContain('تبرع الآن'));
  });

  describe('quick donate (SW-2: header, floating button, home card)', () => {
    it('is never available in showcase, even with gift categories', () => {
      configure(true);
      const quick = TestBed.inject(QuickDonate);
      quick.giftCategoryCount.set(4);
      expect(quick.available()).toBe(false);
    });

    it('live: available once gift categories are known', () => {
      configure(false);
      const quick = TestBed.inject(QuickDonate);
      quick.giftCategoryCount.set(4);
      expect(quick.available()).toBe(true);
    });
  });

  describe('JSON-LD (SW-2)', () => {
    const urls = { home: 'h', category: 'c', page: 'p' };
    const names = { home: 'الرئيسية', association: 'الجمعية' };

    it('showcase: no DonateAction, the breadcrumb stays', () => {
      const ld = projectJsonLd(DETAIL, 'ar', urls, names, true);
      expect(ld.map((x) => x['@type'])).toEqual(['BreadcrumbList']);
    });

    it('live: DonateAction then the breadcrumb', () => {
      const ld = projectJsonLd(DETAIL, 'ar', urls, names, false);
      expect(ld.map((x) => x['@type'])).toEqual(['DonateAction', 'BreadcrumbList']);
    });
  });
});
