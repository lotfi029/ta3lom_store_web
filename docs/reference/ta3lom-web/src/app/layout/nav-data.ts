import { I18nService } from '../core/i18n';
import { ABOUT_GROUP, ABOUT_LINKS, GOVERNANCE_GROUP, GOVERNANCE_SECTIONS } from '../core/site-sections';

export interface NavLink {
  label: string;
  path: string;
}

export interface NavGroup {
  id: string;
  label: string;
  path?: string;
  links?: NavLink[];
}

/** Shared between the desktop dropdown nav and the mobile flat menu — one source of truth. */
export function buildNavGroups(i18n: I18nService): NavGroup[] {
  return [
    { id: 'home', label: i18n.pick('الرئيسية', 'Home'), path: '/' },
    {
      id: 'nav-about',
      label: i18n.pick(ABOUT_GROUP.titleAr, ABOUT_GROUP.titleEn),
      links: ABOUT_LINKS.map((l) => ({ label: i18n.pick(l.titleAr, l.titleEn), path: l.path })),
    },
    /**
     * Governance (CR-02): the transparency cluster, a top level of its own, every child a
     * documents page. Both groups come from core/site-sections.ts, which the section sub-navs and
     * the crumbs read too, so the header and the pages can't disagree about order or names.
     *
     * The first child is the group's own landing page: a dropdown trigger here is a <button>, not a
     * link, so without it that page would be reachable only through the sub-nav — the same shape
     * the media dropdown uses. It is labelled "اللوائح والسياسات", not the group name: two
     * identically-named controls with different roles and destinations side by side confuse a
     * screen reader's elements list, and the trigger already supplies the context.
     *
     * Paths never moved — only labels — because a URL is a contract that sitemap.xml, the
     * prerendered output and any shared link already depend on. That's why these pages, and the new
     * ones, live under /about/* even though they are no longer in the About group.
     */
    {
      id: 'nav-structure',
      label: i18n.pick(GOVERNANCE_GROUP.titleAr, GOVERNANCE_GROUP.titleEn),
      links: GOVERNANCE_SECTIONS.map((l) => ({ label: i18n.pick(l.titleAr, l.titleEn), path: l.path })),
    },
    { id: 'programs', label: i18n.pick('البرامج', 'Programs'), path: '/programs' },
    { id: 'videos', label: i18n.pick('الفيديو', 'Videos'), path: '/videos' },
    {
      id: 'nav-media',
      label: i18n.pick('المركز الإعلامي', 'Media'),
      links: [
        { label: i18n.pick('الأخبار', 'News'), path: '/media/news' },
        { label: i18n.pick('المقالات', 'Articles'), path: '/media/articles' },
        { label: i18n.pick('الملف الصحفي', 'Press kit'), path: '/media/press' },
      ],
    },
    { id: 'partners', label: i18n.pick('الشركاء', 'Partners'), path: '/partners' },
    {
      id: 'nav-involve',
      label: i18n.pick('شارك معنا', 'Get involved'),
      links: [
        { label: i18n.pick('التطوع', 'Volunteer'), path: '/get-involved/volunteer' },
        { label: i18n.pick('عضوية الجمعية', 'Association membership'), path: '/get-involved/membership' },
      ],
    },
    { id: 'contact', label: i18n.pick('تواصل', 'Contact'), path: '/contact' },
  ];
}
