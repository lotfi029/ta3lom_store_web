import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import type { MessageTemplate, TemplateTestResult } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { normalizeSaudiMobile } from '../../../core/i18n/western-digits';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { PlatformData } from '../platform.data';
import { Requires } from '../ui/requires';

/** R5 message templates (contract 15 §2.8): the sign-in code (SMS) and staff alerts (e-mail), per locale. */
export const TEMPLATE_KEYS = [
  'order_paid',
  'otp',
  'shipment_shipped',
  'shipment_delivered',
  'refund_done',
  'staff_alert',
] as const;

/** A local preview: every `{{ name }}` shows as `[name]` (what the API's test send does for unset variables). */
export function previewText(text: string | null | undefined): string {
  return (text ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, '[$1]');
}

const id = (t: Pick<MessageTemplate, 'key' | 'channel' | 'locale'>): string =>
  `${t.key}/${t.channel}/${t.locale}`;

/**
 * Message templates (contract 15 §2.8): pick one, edit subject/body (`staff:templates`), preview, test send (5 per hour;
 * a 429 says when to retry; a Scriban error shows its line and column).
 */
@Component({
  selector: 'ta-admin-templates',
  imports: [ResourceState, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './templates.page.html',
  styleUrls: ['../admin-common.css', './templates.page.css'],
})
export class TemplatesPage {
  protected readonly data = inject(PlatformData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly canEdit = computed(() => this.auth.can('staff:templates'));
  /** The values the API renders a test with (Scriban `{{ name }}`), contract 15 §2.8. */
  protected readonly variables = 'code, name, reference, amount, subject, body';
  protected readonly list = computed(() =>
    (valueOf(this.data.templates) ?? []).filter((t) =>
      (TEMPLATE_KEYS as readonly string[]).includes(t.key),
    ),
  );
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(
    () => this.list().find((t) => id(t) === this.selectedId()) ?? this.list()[0] ?? null,
  );
  protected readonly subject = signal('');
  protected readonly body = signal('');
  protected readonly preview = computed(() => ({
    subject: previewText(this.subject()),
    body: previewText(this.body()),
  }));
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly recipient = signal('');
  protected readonly testing = signal(false);
  protected readonly testError = signal<string | null>(null);
  protected readonly testResult = signal<TemplateTestResult | null>(null);
  protected readonly idOf = id;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-templates:قوالب الرسائل`,
      description: '',
      path: '/admin/templates',
      noindex: true,
    });
    effect(() => {
      const t = this.selected();
      untracked(() => {
        this.subject.set(t?.subject ?? '');
        this.body.set(t?.body ?? '');
        this.error.set(null);
        this.testResult.set(null);
        this.testError.set(null);
      });
    });
  }

  protected label(t: MessageTemplate): string {
    const ch =
      t.channel === 'sms'
        ? $localize`:@@store.admin.channel-sms:رسالة نصية`
        : $localize`:@@store.admin.channel-email:بريد إلكتروني`;
    return `${t.key} · ${ch} · ${t.locale === 'en' ? 'English' : 'العربية'}`;
  }

  protected pick(event: Event): void {
    this.selectedId.set((event.target as HTMLSelectElement).value);
  }

  protected onSubject(event: Event): void {
    this.subject.set((event.target as HTMLInputElement).value);
  }

  protected onBody(event: Event): void {
    this.body.set((event.target as HTMLTextAreaElement).value);
  }

  protected onRecipient(event: Event): void {
    this.recipient.set((event.target as HTMLInputElement).value);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const t = this.selected();
    if (!t || !this.canEdit() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.data.saveTemplate(t, {
        subject: t.channel === 'email' ? this.subject() : null,
        body: this.body(),
      });
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (e) {
      this.error.set(problemMessage(toProblem(e)));
    } finally {
      this.saving.set(false);
    }
  }

  protected async test(event: Event): Promise<void> {
    event.preventDefault();
    const t = this.selected();
    if (!t || !this.canEdit() || this.testing()) return;
    const raw = this.recipient().trim();
    const to = t.channel === 'sms' ? normalizeSaudiMobile(raw) : null;
    if (t.channel === 'sms' && !to) {
      this.testError.set(
        $localize`:@@store.error.otp-mobile-invalid:أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05.`,
      );
      return;
    }
    this.testing.set(true);
    this.testError.set(null);
    try {
      this.testResult.set(
        await this.data.testTemplate({
          channel: t.channel,
          subject: t.channel === 'email' ? this.subject() : null,
          body: this.body(),
          to,
        }),
      );
    } catch (e) {
      this.testError.set(problemMessage(toProblem(e)));
    } finally {
      this.testing.set(false);
    }
  }
}
