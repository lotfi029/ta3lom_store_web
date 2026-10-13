import { environment } from '../../environments/environment';
import type { Locale } from './i18n';

/** Dev-server ports, mirroring .claude/launch.json (ta3lom-dev / ta3lom-dev-en). */
const DEV_ORIGIN_BY_LOCALE: Record<Locale, string> = {
  ar: 'http://localhost:4200',
  en: 'http://localhost:4201',
};

/**
 * Makes `/ar/...` and `/en/...` behave in development the way they do in production.
 *
 * The deployed site is two separate prerendered builds served from real `/ar/` and `/en/`
 * directories (ADR-002), so those URLs are directories, not routes. `ng serve` builds ONE locale
 * and serves it at the root, so the same URLs matched no route and rendered
 * "الصفحة غير موجودة" — whether typed by hand or followed from the language switch.
 *
 * Translations are compiled in per build (LOCALE_ID is fixed — see i18n.ts), so one dev server
 * genuinely cannot render the other language. There are therefore only two correct outcomes:
 *   - the prefix is THIS build's locale  -> rewrite the URL without it and carry on
 *   - the prefix is the OTHER locale     -> hand the browser to that locale's dev server
 *
 * Deliberately NOT a router guard: a route with a custom matcher makes Angular's prerenderer
 * fail outright ("Routes with matchers cannot use prerendering"), which takes down the whole
 * dev server. Running before the router sees the URL avoids the router entirely, so production
 * routing and prerendering are untouched — `environment.production` short-circuits it anyway.
 */
export function resolveDevLocalePrefix(current: Locale, onUnavailable?: (locale: Locale) => void): void | Promise<void> {
  if (environment.production || typeof window === 'undefined') return;

  const match = /^\/(ar|en)(?=\/|$)/.exec(window.location.pathname);
  if (!match) return;

  const requested = match[1] as Locale;
  const rest = `${window.location.pathname.slice(match[0].length) || '/'}${window.location.search}${window.location.hash}`;

  if (requested === current) {
    // Same language, wrong shape for this server — drop the prefix without a reload so the
    // router bootstraps on a URL it recognises. `replace` keeps the dead URL out of history.
    window.history.replaceState(null, '', rest);
    return;
  }

  return handOff(DEV_ORIGIN_BY_LOCALE[requested], rest, requested, onUnavailable);
}

/**
 * Hands over only once the other locale's dev server has actually answered, rather than
 * redirecting blind into an origin that may not be listening.
 *
 * Note which layer normally catches a dead server: `proxy.conf.mjs` forwards `/en` to 4201, so
 * when 4201 is down the DOCUMENT fails and the proxy's own error page explains it — this code
 * never gets to run, because the app never boots. The branch below is the fallback for the case
 * where the Arabic document does load on a prefixed URL (a dev server started without the proxy
 * config, say), where without it the browser would navigate to a dead origin and show nothing.
 *
 * A refused connection rejects this fetch immediately, so the probe costs nothing in the working
 * case — and it only runs on a URL that already carries the other locale's prefix, never on an
 * ordinary page load. `no-cors` because the response body is irrelevant; the question is purely
 * "is anything listening".
 */
async function handOff(
  origin: string,
  rest: string,
  requested: Locale,
  onUnavailable?: (locale: Locale) => void,
): Promise<void> {
  try {
    await fetch(origin, { mode: 'no-cors', cache: 'no-store' });
  } catch {
    // Stay put on a page that works, rather than navigating into a dead end. Strip the prefix so
    // the router still has a URL it recognises.
    window.history.replaceState(null, '', rest);
    onUnavailable?.(requested);
    return;
  }

  window.location.replace(`${origin}${rest}`);
}
