import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { refreshAfterHydration } from './refresh-after-hydration';

/**
 * Phase A of the code-review remediation (ta3lom-web/../../docs/code-review/remediation-plan.md):
 * `refreshAfterHydration` is the fix for a real production bug (a published video visible on
 * /videos but not on the home page, because the home page's request was answered entirely from
 * Angular's HTTP transfer cache). The one behaviour that matters is that EVERY resource passed
 * in gets reloaded — a version that stopped after the first argument would silently under-refresh
 * a multi-resource page like home.data.ts's HomeData (6 resources) with no visible symptom until
 * someone noticed stale data on exactly the resources after the first.
 */
describe('refreshAfterHydration', () => {
  it('reloads every given resource exactly once, after the next render — not zero, not just the first', async () => {
    const reloadA = vi.fn(() => true);
    const reloadB = vi.fn(() => true);
    const reloadC = vi.fn(() => true);

    @Component({ selector: 'ta-test-host', template: '' })
    class TestHost {
      constructor() {
        refreshAfterHydration({ reload: reloadA }, { reload: reloadB }, { reload: reloadC });
      }
    }

    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    await fixture.whenStable();

    // The real bug this guards against: a version that only reloaded resources[0] (e.g. an
    // off-by-one, or `resources[0].reload()` typo'd in place of the loop) would leave this
    // assertion on reloadA green while silently leaving every OTHER resource on the page stale —
    // exactly the shape of bug that produced the reported symptom in the first place, just on a
    // different resource.
    expect(reloadA).toHaveBeenCalledTimes(1);
    expect(reloadB).toHaveBeenCalledTimes(1);
    expect(reloadC).toHaveBeenCalledTimes(1);
  });

  it('reloads a single resource too', async () => {
    const reload = vi.fn(() => true);

    @Component({ selector: 'ta-test-host-one', template: '' })
    class TestHost {
      constructor() {
        refreshAfterHydration({ reload });
      }
    }

    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
