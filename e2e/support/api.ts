/** Direct store-API reads for e2e assertions (the same real API the built app talks to). */
export const API = (process.env['STORE_API_URL'] ?? 'http://localhost:5080/v1').replace(/\/$/, '');

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'Accept-Language': 'ar' } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}
