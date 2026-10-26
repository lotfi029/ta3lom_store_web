import { Component, PendingTasks } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { refreshAfterHydration } from './refresh-after-hydration';

let reloads = 0;
const resource = { reload: () => (++reloads, true) };

@Component({ template: '' })
class Host {
  constructor() {
    refreshAfterHydration(resource);
  }
}

describe('refreshAfterHydration', () => {
  it('reloads only once the app is stable — the transfer cache answers every GET before that', async () => {
    reloads = 0;
    const done = TestBed.inject(PendingTasks).add(); // e.g. hydration still replaying cached responses
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 20));
    expect(reloads).toBe(0);
    done();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    expect(reloads).toBe(1);
  });
});
