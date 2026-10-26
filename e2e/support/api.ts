/** Direct store-API reads for e2e assertions (the same real API the built app talks to). */
export const API = (process.env['STORE_API_URL'] ?? 'http://localhost:5080/v1').replace(/\/$/, '');

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'Accept-Language': 'ar' } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

/** True when the e2e run talks to the CI stub (scripts/stub-api.mjs) rather than the real local API. */
export const onStub = /localhost:3000/.test(API);

/** Clears the stub's in-memory state (cart, session, orders) so specs never see each other's data. No-op on the real API. */
export async function resetStub(): Promise<void> {
  if (onStub) await fetch(`${API.replace(/\/v1$/, '')}/__reset`, { method: 'POST' });
}
