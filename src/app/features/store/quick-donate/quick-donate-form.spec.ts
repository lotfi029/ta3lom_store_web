import { LOCALE_ID, computed, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Category } from '../../../core/api/api.types';
import type { StoreProblem } from '../../../core/api/problem';
import { StoreConfig } from '../../../core/api/store-config';
import { CartStore } from '../../../core/cart/cart-store';
import { QuickDonateForm } from './quick-donate-form';

const cat = (id: string, nameAr: string): Category => ({
  id,
  slug: id,
  nameAr,
  nameEn: null,
  descriptionAr: null,
  descriptionEn: null,
  imageUrl: null,
  imageAltAr: null,
  imageAltEn: null,
  acceptsGeneralGifts: true,
  projectCount: 0,
});

/** Config from the API (never hard-coded in the component): min 10, max 100000, presets 50/100/500. */
const config = {
  ready: computed(() => true),
  minGiftAmount: computed(() => '10.00'),
  maxLineAmount: computed(() => '100000.00'),
  amountPresets: computed(() => ['50.00', '100.00', '500.00']),
};

function mount(list: Category[], variant: 'inline' | 'modal', add = async () => true) {
  const cart = {
    add: vi.fn(add),
    lastProblem: signal<StoreProblem | null>(null),
  };
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: LOCALE_ID, useValue: 'ar' },
      { provide: StoreConfig, useValue: config },
      { provide: CartStore, useValue: cart },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const f = TestBed.createComponent(QuickDonateForm);
  f.componentRef.setInput('list', list);
  f.componentRef.setInput('variant', variant);
  f.componentRef.setInput('idPrefix', 'qi');
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, cart, nav };
}

const flush = () => new Promise((r) => setTimeout(r));

describe('inline quick donate (Option C §3 row 4, §5; C-3; M-4)', () => {
  it('one gift category: no select, presets from the config', () => {
    const { el } = mount([cat('fund', 'الصندوق العام')], 'inline');
    expect(el.querySelector('select')).toBeNull();
    const presets = [...el.querySelectorAll('.preset')].map((b) => b.textContent?.trim());
    expect(presets).toHaveLength(3);
  });

  it('C-3: several → a select, the first category (API sort) preselected; submit posts {categoryId, amount} → /checkout', async () => {
    const { f, el, cart, nav } = mount(
      [cat('fund', 'الصندوق العام'), cat('dawah', 'الدعوة')],
      'inline',
    );
    const select = el.querySelector('select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('fund');
    (el.querySelectorAll('.preset')[0] as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await flush();
    expect(cart.add).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'category', categoryId: 'fund', amount: '50.00' }),
    );
    expect(nav).toHaveBeenCalledWith('/checkout', expect.anything());
  });

  it('M-4: an amount under minGiftAmount is refused before any request', async () => {
    const { f, el, cart } = mount([cat('fund', 'الصندوق العام')], 'inline');
    const input = el.querySelector('input[inputmode=decimal]') as HTMLInputElement;
    input.value = '5';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    f.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await flush();
    f.detectChanges();
    expect(cart.add).not.toHaveBeenCalled();
    expect(el.querySelector('.err')?.textContent).toContain('10');
  });

  it('F-5: an amount over maxLineAmount (from the config) is refused before any request', async () => {
    const { f, el, cart } = mount([cat('fund', 'الصندوق العام')], 'inline');
    const input = el.querySelector('input[inputmode=decimal]') as HTMLInputElement;
    input.value = '100000.01';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    f.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await flush();
    f.detectChanges();
    expect(cart.add).not.toHaveBeenCalled();
    expect(el.querySelector('.err')?.textContent).toMatch(/100[,٬]?000/);
  });

  it('M-4: an API refusal (422) is shown inline, no navigation', async () => {
    const { f, el, cart, nav } = mount([cat('fund', 'الصندوق العام')], 'inline', async () => false);
    cart.lastProblem.set({
      code: 'cart.target_unavailable',
      status: 422,
      detail: null,
      errors: {},
      extra: {},
      retryAfterSeconds: null,
    });
    (el.querySelectorAll('.preset')[1] as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await flush();
    f.detectChanges();
    expect(nav).not.toHaveBeenCalled();
    expect(el.querySelector('.banner.err')?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('modal variant keeps the "اختر" placeholder and preselects nothing when there are several', () => {
    const { el } = mount([cat('fund', 'الصندوق العام'), cat('dawah', 'الدعوة')], 'modal');
    const select = el.querySelector('select') as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    expect(select.value).toBe('');
  });
});
