import { staff } from './auth';

/** Admin-side changes for e2e scenarios (price changed, out of stock) — always restored by the caller. */
export async function bookFormat(slug: string, kind: 'print' | 'digital') {
  const manager = await staff('store_manager');
  const list = await manager.call('GET', '/v1/admin/products?pageSize=100');
  const product = list.body.items.find((p: { slug: string }) => p.slug === slug);
  const detail = await manager.call('GET', `/v1/admin/products/${product.id}`);
  const f = detail.body.formats.find((x: { kind: string }) => x.kind === kind);
  return { manager, format: f };
}

export async function setFormatPrice(slug: string, kind: 'print' | 'digital', price: string): Promise<string> {
  const { manager, format: f } = await bookFormat(slug, kind);
  const res = await manager.call('PUT', `/v1/admin/formats/${f.id}`, {
    kind: f.kind, sku: f.sku, price, compareAtPrice: f.compareAtPrice ?? null, isActive: f.isActive ?? true,
    weightGrams: f.weightGrams ?? null, lowStockThreshold: f.lowStockThreshold ?? null, fileAssetId: f.fileAssetId ?? null,
  });
  if (res.status !== 200) throw new Error(`price ${slug}: ${res.status} ${JSON.stringify(res.body)}`);
  return f.price;
}

/** Moves print stock by `delta` (restock / adjustment); returns the stock row after the move. */
export async function moveStock(slug: string, delta: number) {
  const { format } = await bookFormat(slug, 'print');
  const fulfilment = await staff('fulfilment');
  const res = await fulfilment.call('POST', `/v1/admin/stock/${format.id}/movements`, { delta, reason: delta > 0 ? 'restock' : 'adjustment', note: 'e2e' });
  if (res.status !== 201) throw new Error(`stock ${slug}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { available: number };
}

export async function printAvailable(slug: string): Promise<number> {
  const fulfilment = await staff('fulfilment');
  const { format } = await bookFormat(slug, 'print');
  const rows = await fulfilment.call('GET', '/v1/admin/stock');
  return rows.body.find((r: { formatId: string }) => r.formatId === format.id).available;
}
