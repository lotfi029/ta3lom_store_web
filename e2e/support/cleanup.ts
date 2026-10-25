import { readStaff, staffLogin, writeStaff } from '../../scripts/lib/store-api-client.mjs';

/**
 * Hides what the admin e2e published in the shared dev database: archives projects whose slug starts with `e2e-prj-`
 * and deactivates categories whose slug starts with `e2e-cat-`, so the storefront specs see the seeded catalogue the
 * pages were prerendered from. Nothing can be deleted through the API; archived/inactive rows stay for the audit log.
 */
export async function hideE2eCatalogue(): Promise<void> {
  const staff = readStaff();
  const c = await staffLogin(staff.store_manager);
  writeStaff(staff);
  for (let page = 1; ; page++) {
    const r = await c.call('GET', `/v1/admin/projects?status=published&page=${page}&pageSize=100`);
    const items: { id: string; slug: string }[] = r.body?.items ?? [];
    for (const p of items.filter((x) => x.slug.startsWith('e2e-prj-')))
      await c.call('POST', `/v1/admin/projects/${p.id}/archive`);
    if (items.length < 100) break;
  }
  const cats = await c.call('GET', '/v1/admin/categories');
  for (const cat of (cats.body ?? []) as Record<string, unknown>[])
    if (String(cat['slug']).startsWith('e2e-cat-') && cat['isActive'])
      await c.call('PUT', `/v1/admin/categories/${cat['id']}`, {
        slug: cat['slug'],
        nameAr: cat['nameAr'],
        nameEn: cat['nameEn'],
        descriptionAr: cat['descriptionAr'],
        descriptionEn: cat['descriptionEn'],
        imageAssetId: cat['imageAssetId'],
        acceptsGeneralGifts: cat['acceptsGeneralGifts'],
        sort: cat['sort'],
        isActive: false,
        version: cat['version'],
      });
}
