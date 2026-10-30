import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { ToastService } from '../../core/ui/toast.service';
import { AccountData } from './account.data';
import { ProfilePage } from './profile.page';

describe('ProfilePage — sign out everywhere', () => {
  const data = { me: signal(null), logoutAll: vi.fn(async () => undefined) };
  let page: { logoutAll(): Promise<void> };
  let toast: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AccountData, useValue: data }],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    toast = TestBed.inject(ToastService);
    page = TestBed.runInInjectionContext(() => new ProfilePage()) as unknown as typeof page;
  });

  it('confirms only when every session was revoked', async () => {
    await page.logoutAll();
    expect(toast.current()?.tone).toBe('success');
  });

  it('shows the error, never the success message, when logout-all failed', async () => {
    data.logoutAll.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    await page.logoutAll();
    expect(toast.current()?.tone).toBe('error');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/');
  });
});
