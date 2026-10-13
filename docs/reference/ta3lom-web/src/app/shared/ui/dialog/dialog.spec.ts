import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { Dialog } from './dialog';

/**
 * Session 1 owed test (08-testing-and-budgets.md): the dialog's focus trap, Escape and focus
 * restoration. Built on the native <dialog> element deliberately — see dialog.ts's own header
 * comment — so what is under test here is that this component wires showModal()/close()
 * correctly, not a hand-rolled trap.
 *
 * ⚠️ jsdom (and every real UA) only restores focus to the element that had focus BEFORE
 * showModal() was called. A synthetic `element.click()` does not move focus the way a real
 * pointer/keyboard interaction does, so the test below calls `.focus()` on the trigger
 * explicitly. Do not "fix" the component if a version of this test written with a synthetic
 * click appears to fail — the component is correct; the test would not be.
 */
@Component({
  selector: 'ta-test-host',
  imports: [Dialog],
  template: `
    <button #trigger type="button">open</button>
    <ta-dialog [open]="open()" [lightDismiss]="lightDismiss()" labelledBy="dlg-title" (closed)="open.set(false)">
      <h2 id="dlg-title">Title</h2>
      <button type="button">inside</button>
    </ta-dialog>
  `,
})
class TestHost {
  readonly open = signal(false);
  readonly lightDismiss = signal(true);
}

describe('Dialog', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    return fixture;
  }

  it('calls showModal() when open becomes true, and reflects it on the native element', () => {
    const fixture = setup();
    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    expect(dialogEl.open).toBe(false);

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(dialogEl.open).toBe(true);
  });

  it('sets aria-labelledby from the required input', () => {
    const fixture = setup();
    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    expect(dialogEl.getAttribute('aria-labelledby')).toBe('dlg-title');
  });

  it('emits closed when the dialog closes natively (e.g. Escape), whatever the cause', () => {
    const fixture = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialogEl.close(); // simulates Escape — which fires the native 'close' event.
    fixture.detectChanges();

    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('restores focus to the element that opened it, when that element was actually focused', () => {
    const fixture = setup();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    trigger.focus(); // a real focus call — see the header comment on why not element.click().
    expect(document.activeElement).toBe(trigger);

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialogEl.close();
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);
  });

  /**
   * Backdrop dismissal. A native <dialog> hit-tests backdrop pixels to the dialog ELEMENT itself,
   * so `target === dialogEl` is what "the pointer is on the backdrop" means — which is why the
   * component requires the dialog to carry no visible padding. jsdom does no hit-testing, so these
   * dispatch the events with the target the browser would set.
   */
  function pointer(el: Element, type: 'pointerdown' | 'pointerup') {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true }));
  }

  it('closes when a pointer press AND release both land on the backdrop', () => {
    const fixture = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');

    pointer(dialogEl, 'pointerdown');
    pointer(dialogEl, 'pointerup');
    fixture.detectChanges();

    expect(dialogEl.open).toBe(false);
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('does NOT close when the gesture starts inside the box and ends on the backdrop', () => {
    // The text-selection drag. Closing here would throw away both the selection and the dialog,
    // which is exactly why this listens on pointerdown/pointerup instead of click.
    const fixture = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    const inside: HTMLElement = dialogEl.querySelector('h2')!;

    pointer(inside, 'pointerdown'); // bubbles to the dialog, but target is the heading
    pointer(dialogEl, 'pointerup');
    fixture.detectChanges();

    expect(dialogEl.open).toBe(true);
  });

  it('does NOT close on a press and release inside the box', () => {
    const fixture = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    const inside: HTMLElement = dialogEl.querySelector('h2')!;

    pointer(inside, 'pointerdown');
    pointer(inside, 'pointerup');
    fixture.detectChanges();

    expect(dialogEl.open).toBe(true);
  });

  it('ignores backdrop presses when lightDismiss is off (the alt-text dialog)', () => {
    const fixture = setup();
    fixture.componentInstance.lightDismiss.set(false);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');

    pointer(dialogEl, 'pointerdown');
    pointer(dialogEl, 'pointerup');
    fixture.detectChanges();

    expect(dialogEl.open).toBe(true);
  });

  it('closes the native dialog when open is set back to false programmatically', () => {
    const fixture = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    expect(dialogEl.open).toBe(true);

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(dialogEl.open).toBe(false);
  });
});

/**
 * 4.12 (admin-dashboard-code-review.md): `open` used to be a plain `input()`. After a native
 * close (Escape, backdrop), `el.open` was false but `open()` stayed whatever the caller's own
 * (closed) handler last set it to — and if a caller forgot to reset it there, `open()` stayed
 * `true` forever while the dialog sat closed. The next `showModal()` attempt silently did
 * nothing, because the effect's own guard (`!el.open`) read as already satisfied: `open()` was
 * already `true`, so setting it to `true` again produced no signal change and the effect never
 * re-ran. Converting `open` to a `model()` that self-resets in `onNativeClose()` fixes this from
 * the INSIDE, independent of whatever the caller's own (closed) handler does.
 */
@Component({
  selector: 'ta-test-host-forgetful',
  imports: [Dialog],
  template: `
    <ta-dialog [open]="open()" labelledBy="dlg-title-2">
      <h2 id="dlg-title-2">Title</h2>
    </ta-dialog>
  `,
})
class ForgetfulTestHost {
  // Deliberately no (closed) handler — this is the bug: a caller that never resets its own flag.
  readonly open = signal(false);
}

describe('Dialog — self-heals when a caller forgets to reset `open` on close (4.12)', () => {
  it("the dialog's own copy of `open` becomes false on a native close, even though the host's never does", () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ForgetfulTestHost);
    fixture.detectChanges();
    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    const dialogDebugEl = fixture.debugElement.query(By.directive(Dialog));

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(dialogEl.open).toBe(true);

    dialogEl.close(); // simulates Escape — the host's (missing) (closed) handler does nothing.
    fixture.detectChanges();

    // The host's own flag is exactly the stale value the bug describes — nothing ever resets it.
    expect(fixture.componentInstance.open()).toBe(true);
    // But Dialog's OWN copy is no longer stuck agreeing with it: onNativeClose() wrote it back
    // to false directly, matching what `el.open` already says. With a plain `input()`, this
    // would still read `true` here — whatever the host's one-way binding last pushed, and
    // nothing else could ever have changed it — which is exactly the value the effect's own
    // `!el.open` guard reads to decide whether the NEXT `open` write should call `showModal()`.
    expect(dialogDebugEl.componentInstance.open()).toBe(false);
  });
});
