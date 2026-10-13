import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContactChannel, ContactChannelsData } from '../../core/contact-channels.data';
import { I18nService } from '../../core/i18n';
import { Image } from '../../shared/ui/image/image';
import { Icon } from '../../shared/ui/icon/icon';
import { IconName, isIconName } from '../../shared/ui/icon/icon.data';

@Component({
  selector: 'ta-footer',
  imports: [RouterLink, Image, Icon],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private readonly i18n = inject(I18nService);
  protected readonly contactChannels = inject(ContactChannelsData);

  protected readonly logoAlt = this.i18n.pick('شعار جمعية التعلم الإلكتروني', 'E-Learning Association logo');
  protected readonly about = this.i18n.pick(
    'جمعية تعليمية ملتزمة بتحسين التعليم وتمكين كل فرد من تحقيق أهدافه.',
    'An educational association committed to improving learning and enabling every person to reach their goals.',
  );
  protected readonly quickLabel = this.i18n.pick('روابط سريعة', 'Quick links');
  protected readonly transLabel = this.i18n.pick('الشفافية', 'Transparency');
  protected readonly contactLabel = this.i18n.pick('تواصل', 'Contact');
  protected readonly rights = this.i18n.pick(
    'جميع الحقوق محفوظة لجمعية التعلم الإلكتروني',
    'All rights reserved — E-Learning Association',
  );
  protected readonly year = new Date().getFullYear();

  protected readonly programsLabel = this.i18n.pick('البرامج', 'Programs');
  protected readonly videosLabel = this.i18n.pick('الفيديو', 'Videos');
  protected readonly mediaLabel = this.i18n.pick('المركز الإعلامي', 'Media');
  protected readonly partnersLabel = this.i18n.pick('الشركاء', 'Partners');
  protected readonly donateLabel = this.i18n.pick('المتجر', 'Store');

  protected readonly bylawsLabel = this.i18n.pick('اللوائح والسياسات', 'Bylaws & policies');
  protected readonly reportsLabel = this.i18n.pick('التقارير المالية', 'Financial reports');
  protected readonly assemblyLabel = this.i18n.pick('الجمعية العمومية', 'General assembly');
  protected readonly leadershipLabel = this.i18n.pick('الهيكل الإداري', 'Administrative structure');
  protected readonly beneficiariesLabel = this.i18n.pick('المستفيدون', 'Beneficiaries');

  protected readonly directChannels = computed(() =>
    (this.contactChannels.list.value()?.items ?? []).filter(
      (c: ContactChannel) => c.type === 'email' || c.type === 'phone' || c.type === 'whatsapp',
    ),
  );
  protected readonly address = computed(() =>
    (this.contactChannels.list.value()?.items ?? []).find((c: ContactChannel) => c.type === 'address'),
  );
  protected readonly socialChannels = computed(() =>
    (this.contactChannels.list.value()?.items ?? []).filter((c: ContactChannel) => c.type === 'social'),
  );
  protected readonly hasContactInfo = computed(
    () => this.directChannels().length > 0 || !!this.address() || this.socialChannels().length > 0,
  );
  protected readonly contactUnavailable = this.i18n.pick(
    'معلومات التواصل غير متاحة حاليًا.',
    'Contact information is currently unavailable.',
  );
  protected readonly contactLoadError = this.i18n.pick(
    'تعذر تحميل معلومات التواصل.',
    'Could not load contact information.',
  );

  /** Null for an unrecognised key, so a platform the icon set has not caught up with falls through
   *  to the legacy uploaded image and then the text fallback, rather than rendering a broken glyph. */
  protected channelIcon(channel: ContactChannel): IconName | null {
    return isIconName(channel.icon) ? channel.icon : null;
  }

  protected channelLabel(channel: ContactChannel): string {
    return this.i18n.pick(channel.labelAr, channel.labelEn);
  }
}
