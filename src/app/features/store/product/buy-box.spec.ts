import { TestBed } from '@angular/core/testing';
import type { BookFormat, ProductDetail } from '../../../core/api/api.types';
import { BuyBox, type BuyRequest } from './buy-box';

const course = { id: 'c1', type: 'course', slug: 'c', course: { lessons: 12, price: '120.00' }, book: null } as unknown as ProductDetail;
const book = { id: 'b1', type: 'book', slug: 'b', course: null, book: { formats: [] } } as unknown as ProductDetail;
const print = (available: number): BookFormat => ({ id: 'p', kind: 'print', sku: 'P', price: '65.00', compareAtPrice: null, available, maxQuantity: 20 });
const digital: BookFormat = { id: 'd', kind: 'digital', sku: 'D', price: '35.00', compareAtPrice: null, available: null, maxQuantity: 1 };

function mount(product: ProductDetail, formats: BookFormat[] = [], extra: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(BuyBox);
  fixture.componentRef.setInput('product', product);
  fixture.componentRef.setInput('formats', formats);
  fixture.componentRef.setInput('coursePrice', '120.00');
  for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const added: BuyRequest[] = [];
  fixture.componentInstance.add.subscribe((r) => added.push(r));
  return { fixture, el, added };
}

describe('BuyBox (plan §6 "Buy box")', () => {
  it('course: quantity is always 1', () => {
    const { el, added } = mount(course);
    expect(el.querySelector('.stepper')).toBeNull();
    (el.querySelector('.b.primary') as HTMLButtonElement).click();
    expect(added).toEqual([{ productId: 'c1', bookFormatId: null, quantity: 1 }]);
  });

  it('print: stepper 1…20, never above the stock', async () => {
    const { fixture, el, added } = mount(book, [print(500), digital]);
    const plus = el.querySelectorAll<HTMLButtonElement>('.stepper button')[1];
    for (let i = 0; i < 30; i++) plus.click();
    fixture.detectChanges();
    expect((el.querySelector('.stepper input') as HTMLInputElement).value).toBe('20');
    expect(plus.disabled).toBe(true);
    (el.querySelector('.b.primary') as HTMLButtonElement).click();
    expect(added.at(-1)).toEqual({ productId: 'b1', bookFormatId: 'p', quantity: 20 });

    fixture.componentRef.setInput('formats', [print(3), digital]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((el.querySelector('.stepper input') as HTMLInputElement).value).toBe('3');
  });

  it('digital: quantity 1, no stepper', () => {
    const { fixture, el, added } = mount(book, [print(5), digital]);
    (el.querySelectorAll<HTMLInputElement>('input[type=radio]')[1]).dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelector('.stepper')).toBeNull();
    (el.querySelector('.b.primary') as HTMLButtonElement).click();
    expect(added).toEqual([{ productId: 'b1', bookFormatId: 'd', quantity: 1 }]);
  });

  it('out of stock: the print option is disabled and digital is pre-selected', () => {
    const { el } = mount(book, [print(0), digital]);
    const radios = el.querySelectorAll<HTMLInputElement>('input[type=radio]');
    expect(radios[0].disabled).toBe(true);
    expect(radios[1].checked).toBe(true);
    expect(el.textContent).toContain('نفدت الكمية');
  });

  it('owned course: shows "go to course" instead of add', () => {
    const { el } = mount(course, [], { owned: true });
    expect(el.querySelector('.owned')).not.toBeNull();
    expect(el.textContent).not.toContain('أضف إلى السلة');
  });

  it('total = price × quantity in halalas', () => {
    const { fixture, el } = mount(book, [{ ...print(50), price: '19.99' }]);
    const plus = el.querySelectorAll<HTMLButtonElement>('.stepper button')[1];
    plus.click();
    plus.click();
    fixture.detectChanges();
    expect(el.querySelector('.total')?.textContent).toContain('59.97');
  });
});
