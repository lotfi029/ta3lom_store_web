/**
 * Option C catalogue for e2e, the stub capture and screenshots — added through the ADMIN API (never SQL), idempotent.
 * On top of the API's Development seed (3 categories, 6 projects) it adds 7 categories (one left EMPTY, for the empty
 * state) and 22 published projects, so the home page has > 20 projects (two pages), 9+ category tabs, several `urgent`
 * cards (banner prev/next) and every card shape: options only, open amount only, both.
 * Slugs start with `c-` (categories `c-…`, projects `c-…`): not `e2e-…`, so hideE2eCatalogue() keeps them.
 */
import { png } from './lib/png.mjs';

/** [slug, nameAr, nameEn, acceptsGeneralGifts, rgb] — sort follows the array after the Development seed's three. */
export const CATEGORIES = [
  ['c-water', 'سقيا الماء', 'Water', false, [26, 120, 150]],
  ['c-feeding', 'الإطعام', 'Feeding', false, [170, 120, 40]],
  ['c-orphans', 'كفالة الأيتام', 'Orphan care', false, [110, 80, 150]],
  ['c-health', 'الرعاية الصحية', 'Health care', false, [40, 140, 100]],
  ['c-housing', 'الإسكان', 'Housing', false, [120, 100, 80]],
  ['c-relief', 'الإغاثة', 'Relief', false, [170, 70, 60]],
  ['c-mosques', 'المساجد', 'Mosques', false, [60, 90, 130]], // stays empty (empty-category state)
];

const opt = (labelAr, labelEn, amount) => ({ labelAr, labelEn, amount });
/** [slug, category, titleAr, titleEn, summaryAr, summaryEn, badge, allowOpenAmount, minAmount, options] */
export const PROJECTS = [
  ['c-mosque-cooler', 'c-water', 'برادة مياه لمسجد', 'Water cooler for a mosque', 'ماء بارد للمصلين طوال العام.', 'Cold water for worshippers all year.', 'urgent', true, '10.00', [opt('برادة', 'Cooler', '2500.00')]],
  ['c-water-well', 'c-water', 'حفر بئر', 'Dig a well', 'بئر تروي قرية كاملة لسنوات.', 'A well that serves a whole village for years.', null, false, null, [opt('بئر سطحية', 'Shallow well', '6000.00'), opt('بئر ارتوازية', 'Deep well', '18000.00')]],
  ['c-water-tank', 'c-water', 'خزان مياه', 'Water tank', 'خزان يحفظ الماء للأسر المحتاجة.', 'A tank that stores water for families in need.', 'new', true, '20.00', []],
  ['c-water-bottles', 'c-water', 'سقيا الحجاج', 'Water for pilgrims', 'عبوات ماء تُوزّع في المشاعر.', 'Bottled water handed out at the holy sites.', null, true, '10.00', [opt('كرتون', 'Carton', '15.00')]],
  ['c-food-basket', 'c-feeding', 'سلة غذائية لأسرة', 'Food basket for a family', 'سلة تكفي أسرة لمدة شهر.', 'A basket that feeds a family for a month.', null, true, '10.00', [opt('سلة', 'Basket', '250.00'), opt('سلتان', 'Two baskets', '500.00')]],
  ['c-iftar', 'c-feeding', 'إفطار صائم', 'Iftar meal', 'وجبة إفطار متكاملة للصائمين.', 'A full iftar meal for people fasting.', 'urgent', false, null, [opt('وجبة', 'Meal', '15.00'), opt('عشر وجبات', 'Ten meals', '150.00')]],
  ['c-bread', 'c-feeding', 'خبز يومي', 'Daily bread', 'خبز طازج للأسر المتعففة.', 'Fresh bread for families in need.', null, true, '10.00', []],
  ['c-orphan-sponsor', 'c-orphans', 'كفالة يتيم', 'Sponsor an orphan', 'معيشة وتعليم ورعاية لطفل يتيم.', 'Living costs, schooling and care for an orphan.', 'new', false, null, [opt('شهر', 'One month', '300.00'), opt('سنة', 'One year', '3600.00')]],
  ['c-orphan-eid', 'c-orphans', 'كسوة العيد للأيتام', 'Eid clothes for orphans', 'ملابس العيد لإدخال الفرح على الأيتام.', 'Eid clothes to bring joy to orphans.', null, true, '25.00', [opt('كسوة', 'Outfit', '200.00')]],
  ['c-orphan-school', 'c-orphans', 'تعليم يتيم', 'School for an orphan', 'رسوم دراسية وأدوات لطفل يتيم.', 'School fees and supplies for an orphan.', null, true, '50.00', []],
  ['c-patient-care', 'c-health', 'علاج المرضى غير القادرين', 'Care for patients in need', 'تكاليف العلاج والأدوية للحالات المستحقة.', 'Treatment and medicine for patients who cannot pay.', null, true, '10.00', []],
  ['c-dialysis', 'c-health', 'جلسات غسيل الكلى', 'Dialysis sessions', 'جلسات غسيل كلى لمرضى محتاجين.', 'Dialysis sessions for patients in need.', 'urgent', false, null, [opt('جلسة', 'Session', '400.00'), opt('شهر', 'One month', '4800.00')]],
  ['c-eye-care', 'c-health', 'عمليات العيون', 'Eye surgery', 'عمليات المياه البيضاء لكبار السن.', 'Cataract surgery for older people.', null, true, '50.00', [opt('عملية', 'Operation', '1500.00')]],
  ['c-home-repair', 'c-housing', 'ترميم منازل الأسر المتعففة', 'Home repairs for families', 'إصلاحات تجعل المنزل آمنًا للسكن.', 'Repairs that make a home safe to live in.', null, true, '10.00', []],
  ['c-rent', 'c-housing', 'سداد إيجار', 'Pay the rent', 'سداد إيجار أسرة مهددة بالإخلاء.', 'Rent for a family at risk of eviction.', 'new', true, '100.00', [opt('شهر', 'One month', '1500.00')]],
  ['c-furniture', 'c-housing', 'تأثيث منزل', 'Furnish a home', 'أثاث أساسي لأسرة محتاجة.', 'Basic furniture for a family in need.', null, false, null, [opt('غرفة', 'One room', '2000.00'), opt('منزل', 'Whole home', '8000.00')]],
  ['c-winter-bag', 'c-relief', 'حقيبة شتوية للأسرة', 'Winter bag for a family', 'بطانيات وملابس ومدفأة.', 'Blankets, clothes and a heater.', 'urgent', true, '10.00', [opt('حقيبة', 'Bag', '300.00')]],
  ['c-emergency', 'c-relief', 'إغاثة عاجلة', 'Emergency relief', 'مساعدة فورية للمتضررين من الكوارث.', 'Immediate help for people hit by disasters.', 'urgent', true, '10.00', []],
  ['c-shelter', 'c-relief', 'خيمة إيواء', 'Shelter tent', 'خيمة تؤوي أسرة نازحة.', 'A tent that shelters a displaced family.', null, false, null, [opt('خيمة', 'Tent', '900.00')]],
  ['c-medical-kit', 'c-relief', 'حقيبة إسعافات', 'First-aid kit', 'حقيبة إسعافات أولية للمناطق المنكوبة.', 'A first-aid kit for disaster areas.', null, true, '10.00', [opt('حقيبة', 'Kit', '120.00'), opt('خمس حقائب', 'Five kits', '600.00')]],
  ['c-student-bag', 'education', 'حقيبة الطالب', 'School bag', 'أدوات مدرسية لطلاب الأسر المحتاجة.', 'School supplies for children from families in need.', null, true, '10.00', [opt('حقيبة', 'Bag', '150.00')]],
  ['c-quran-circle', 'dawah', 'حلقة تحفيظ', 'Memorisation circle', 'رواتب معلمي حلقات التحفيظ.', 'Salaries for the teachers of memorisation circles.', null, true, '50.00', []],
];

async function upload(c, nameAr, nameEn, rgb) {
  const form = new FormData();
  form.append('file', new Blob([png(1200, 800, rgb)], { type: 'image/png' }), 'cover.png');
  form.append('kind', 'image');
  form.append('altAr', nameAr);
  form.append('altEn', nameEn);
  const r = await c.call('POST', '/v1/admin/media', form);
  if (r.status !== 201) throw new Error(`media upload: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.id;
}

async function adminProjects(c) {
  const all = [];
  for (let page = 1; ; page++) {
    const r = await c.call('GET', `/v1/admin/projects?page=${page}&pageSize=100`);
    const items = r.body?.items ?? [];
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

/** Adds what is missing; returns counts. `c` is a signed-in staff client with catalogue rights. */
export async function seedCatalogue(c, log = () => {}) {
  const cats = (await c.call('GET', '/v1/admin/categories')).body;
  const bySlug = new Map(cats.map((x) => [x.slug, x]));
  let sort = Math.max(0, ...cats.map((x) => Number(x.sort) || 0));
  const covers = new Map();
  for (const [slug, nameAr, nameEn, gifts, rgb] of CATEGORIES) {
    if (bySlug.has(slug)) continue;
    const r = await c.call('POST', '/v1/admin/categories', {
      slug,
      nameAr,
      nameEn,
      descriptionAr: `مشاريع ${nameAr}.`,
      descriptionEn: `${nameEn} projects.`,
      imageAssetId: null,
      acceptsGeneralGifts: gifts,
      sort: ++sort,
      isActive: true,
      version: null,
    });
    if (r.status !== 201) throw new Error(`category ${slug}: ${r.status} ${JSON.stringify(r.body)}`);
    bySlug.set(slug, r.body);
    log(`category ${slug} created`);
  }

  const existing = new Map((await adminProjects(c)).map((p) => [p.slug, p]));
  let created = 0;
  for (const [i, [slug, catSlug, titleAr, titleEn, summaryAr, summaryEn, badge, open, minAmount, options]] of PROJECTS.entries()) {
    const cat = bySlug.get(catSlug);
    if (!cat) throw new Error(`seed: category ${catSlug} missing`);
    let p = existing.get(slug);
    if (!p) {
      const rgb = CATEGORIES.find((x) => x[0] === catSlug)?.[4] ?? [40, 120, 90];
      if (!covers.has(catSlug)) covers.set(catSlug, await upload(c, cat.nameAr, cat.nameEn ?? cat.nameAr, rgb));
      const r = await c.call('POST', '/v1/admin/projects', {
        categoryId: cat.id,
        slug,
        titleAr,
        titleEn,
        summaryAr,
        summaryEn,
        bodyAr: `${summaryAr}\n\nكل تبرع يصل إلى مستحقيه بإيصال رسمي.`,
        bodyEn: `${summaryEn}\n\nEvery donation reaches the people it is for, with an official receipt.`,
        coverAssetId: covers.get(catSlug),
        allowOpenAmount: open,
        minAmount,
        badge,
        sort: 100 + i,
        seoTitleAr: null,
        seoTitleEn: null,
        seoDescAr: null,
        seoDescEn: null,
        version: null,
      });
      if (r.status !== 201) throw new Error(`project ${slug}: ${r.status} ${JSON.stringify(r.body)}`);
      p = r.body;
      if (options.length) {
        const o = await c.call('PUT', `/v1/admin/projects/${p.id}/options`, {
          options: options.map((x, k) => ({ id: null, ...x, sort: k + 1, isActive: true })),
          version: p.version,
        });
        if (o.status !== 200) throw new Error(`options ${slug}: ${o.status} ${JSON.stringify(o.body)}`);
      }
      created++;
    }
    if (p.status !== 'published') {
      const r = await c.call('POST', `/v1/admin/projects/${p.id}/publish`);
      if (r.status !== 200 && r.status !== 204) throw new Error(`publish ${slug}: ${r.status} ${JSON.stringify(r.body)}`);
    }
  }
  log(`projects: ${created} created, ${PROJECTS.length} in the Option C set`);
}
