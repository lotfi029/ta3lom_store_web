import { HttpErrorResponse } from '@angular/common/http';
import { LOCALE_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { StaffUser } from '../../../core/api/api.types';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { PlatformData } from '../platform.data';
import { StaffPage } from './staff.page';

const USER: StaffUser = {
  id: 's2',
  email: 'viewer@store-web.test',
  name: 'Viewer',
  roles: ['viewer'],
  isActive: true,
  lastLoginAt: null,
  lockedUntil: null,
  mustChangePassword: false,
  totpEnrolled: true,
  createdAt: '2026-10-01T00:00:00Z',
  version: 3,
};

/** F-3: a stale `version` on a staff edit opens the conflict dialog and reloads the list. */
describe('StaffPage conflict (F-3)', () => {
  it('409 concurrency.conflict → conflict dialog + staff.reload(); "load the latest" closes the edit', async () => {
    const reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'ar' },
        { provide: StaffAuth, useValue: { can: () => true, isSignedIn: signal(true) } },
        {
          provide: PlatformData,
          useValue: {
            staff: {
              hasValue: () => true,
              value: () => [USER],
              isLoading: () => false,
              error: () => undefined,
              reload,
            },
            updateStaff: () =>
              Promise.reject(
                new HttpErrorResponse({
                  status: 409,
                  error: { status: 409, code: 'concurrency.conflict' },
                }),
              ),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(StaffPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('tbody tr button.btn.sm')!.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('form button[type=submit]')!.click();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    expect(reload).toHaveBeenCalled();
    const conflict = el.querySelector('ta-conflict-dialog dialog');
    expect(conflict?.hasAttribute('open')).toBe(true);
    expect(el.querySelector('form')?.closest('dialog')?.hasAttribute('open')).toBe(true);
    conflict!.querySelector<HTMLButtonElement>('button.primary')!.click();
    fixture.detectChanges();
    expect(el.querySelector('form')?.closest('dialog')?.hasAttribute('open')).toBe(false);
  });
});
