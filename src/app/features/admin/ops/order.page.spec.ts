import { LOCALE_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { AdminOrderPage } from './order.page';
import { OpsData } from './ops.data';

const tick = () => new Promise((r) => setTimeout(r));

const ORDER = (refunds: object[]) => ({
  reference: 'T3-26-000042',
  status: 'paid',
  totalAmount: '50.00',
  refundedAmount: '0.00',
  refundable: '50.00',
  version: 7,
  lines: [],
  payments: [],
  events: [],
  receipts: [{ number: 'DR-2026-000001', series: 'DR', amount: '50.00', issuedAt: '2026-11-04T10:00:00Z', voidedBy: null }],
  refunds,
  reviewReason: null,
  createdAt: '2026-11-04T09:00:00Z',
  paymentDueAt: '2026-11-04T10:00:00Z',
});

/** Review 04 W-2: pending refunds in the admin order page. */
describe('AdminOrderPage — pending refunds (W-2)', () => {
  function mount(refunds: object[], refund: (key: string) => Promise<object>) {
    const order = signal<object | undefined>(ORDER(refunds));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'ar' },
        { provide: StaffAuth, useValue: { can: () => true, isSignedIn: signal(true) } },
        {
          provide: OpsData,
          useValue: {
            orderRef: signal<string | null>(null),
            order: {
              hasValue: () => !!order(),
              value: () => order(),
              isLoading: () => false,
              error: () => undefined,
              reload: () => undefined,
            },
            refund: (_r: string, _a: string, _why: string, _v: number, key: string) => refund(key),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AdminOrderPage);
    fixture.componentRef.setInput('ref', 'T3-26-000042');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const refundButton = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('.act.fin button')].find((b) => b.textContent?.trim() === 'استرداد')!;

  it('a requested refund disables new refunds and is listed with its status and source', () => {
    const { el } = mount(
      [
        { id: 'r1', amount: '10.00', status: 'requested', reason: 'x', requestedBy: 'f@x', requestedAt: '2026-11-04T10:00:00Z', completedAt: null, source: 'store' },
        { id: 'r2', amount: '5.00', status: 'succeeded', reason: 'y', requestedBy: 'moyasar', requestedAt: '2026-11-04T09:30:00Z', completedAt: null, source: 'gateway' },
      ],
      () => Promise.reject(new Error('not called')),
    );
    expect(refundButton(el).disabled).toBe(true);
    expect(el.querySelector('.pending-note')?.textContent).toContain('بانتظار تأكيد بوابة الدفع');
    const text = el.textContent ?? '';
    expect(text).toContain('بانتظار تأكيد البوابة');
    expect(text).toContain('من لوحة بوابة الدفع');
    expect(text).toContain('من المتجر');
  });

  it('a 202 pending answer keeps the dialog open and the same key for "check again"', async () => {
    const keys: string[] = [];
    let answer: object = { reference: 'T3-26-000042', status: 'paid', refund: 'pending' };
    const { fixture, el } = mount([], (key) => {
      keys.push(key);
      return Promise.resolve(answer);
    });
    refundButton(el).click();
    fixture.detectChanges();
    const set = (id: string, v: string) => {
      const input = document.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = v;
      input.dispatchEvent(new Event('input'));
    };
    set('ao-amount', '10');
    set('ao-reason', 'طلب المتبرع');
    set('ao-typed', 'T3-26-000042');
    fixture.detectChanges();
    const submit = () => document.querySelector<HTMLButtonElement>('form.dlg button[type=submit]')!;
    submit().click();
    await tick();
    fixture.detectChanges();
    expect(document.querySelector('form.dlg .pending')?.textContent).toContain('لم تؤكد بوابة الدفع');
    expect(submit().textContent).toContain('تحقق مجددًا');

    answer = { reference: 'T3-26-000042', status: 'paid', refund: 'succeeded' };
    submit().click();
    await tick();
    fixture.detectChanges();
    expect(keys.length).toBe(2);
    expect(keys[1]).toBe(keys[0]);                          // never a second refund
    expect(document.querySelector('form.dlg .pending')).toBeNull();
  });
});
