/**
 * A deliberately small Markdown subset for project stories (C-5). The source is parsed into a tree of allowed nodes
 * only — paragraphs, headings h2–h4, strong/em, bullet and numbered lists, blockquotes and links — and rendered by
 * `<ta-markdown>` through Angular templates: every character of the source ends up as TEXT (Angular escapes it), never
 * as HTML. There is no HTML pass-through at all: `<script>`, `<img onerror>` … are shown as the literal characters.
 * Links keep only `https:` and `mailto:` targets (after trimming; any control character, whitespace or encoded scheme
 * disqualifies the URL) — anything else renders as plain text. Headings start at h2 because the page title is the h1.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'link'; href: string; external: boolean; children: Inline[] };

export type Block =
  | { kind: 'p'; inlines: Inline[] }
  | { kind: 'h'; level: 2 | 3 | 4; inlines: Inline[] }
  | { kind: 'ul' | 'ol'; items: Inline[][] }
  | { kind: 'quote'; blocks: Block[] };

/** The API caps a body at 20,000 characters; anything beyond this is not parsed (and not shown). */
export const MAX_SOURCE = 20_000;
const MAX_DEPTH = 4;

/** A link target the story may use, or null. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  // No whitespace, control characters, backslashes or percent-encoding inside the scheme part.
  if (
    !href ||
    /[\s\\]/.test(href) ||
    [...href].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)
  )
    return null;
  const lower = href.toLowerCase();
  if (lower.startsWith('mailto:'))
    return /^mailto:[^@\s<>()]+@[^@\s<>()]+\.[^@\s<>()]+$/i.test(href) ? href : null;
  if (!lower.startsWith('https://')) return null;
  try {
    const u = new URL(href);
    return u.protocol === 'https:' && !!u.hostname ? u.href : null;
  } catch {
    return null;
  }
}

const LINK = /\[([^[\]\n]{1,300})\]\(([^()\s]{1,2000})\)/g;
const STRONG = /\*\*([^*\n](?:[^*\n]|\*(?!\*)){0,999}?)\*\*/g;
const EM = /(?:\*([^*\n]{1,1000}?)\*|_([^_\n]{1,1000}?)_)/g;
/** Inline nodes per block (F-8): past this, the rest of the block stays plain text — nothing is dropped. */
export const MAX_INLINE_NODES = 500;

/** Inline markup → nodes. Unmatched markers stay as text. */
export function parseInline(text: string, depth = 0): Inline[] {
  return inline(text, depth, { left: MAX_INLINE_NODES });
}

/**
 * One left-to-right pass (F-8): the next match of each token is cached and searched again only once the scan has
 * passed it, so a long block costs O(length) instead of re-scanning the rest of the text after every match. At equal
 * positions a link wins over strong over em (as before).
 */
function inline(text: string, depth: number, budget: { left: number }): Inline[] {
  if (!text) return [];
  const out: Inline[] = [];
  /** Every node pushed counts against the block's budget. */
  const push = (n: Inline) => {
    out.push(n);
    budget.left--;
  };
  if (depth > MAX_DEPTH || budget.left <= 4) {
    push({ kind: 'text', text });
    return out;
  }
  const tokens = [new RegExp(LINK), new RegExp(STRONG), new RegExp(EM)];
  const next: (RegExpExecArray | null | undefined)[] = [undefined, undefined, undefined];
  let pos = 0;
  // Room is kept for a node, the text before it and the text after the loop.
  while (pos < text.length && budget.left > 4) {
    let best = -1;
    for (let k = 0; k < tokens.length; k++) {
      const cached = next[k];
      if (cached === undefined || (cached !== null && cached.index < pos)) {
        tokens[k].lastIndex = pos;
        next[k] = tokens[k].exec(text);
      }
      const m = next[k];
      if (m && (best < 0 || m.index < (next[best] as RegExpExecArray).index)) best = k;
    }
    if (best < 0) break;
    const m = next[best] as RegExpExecArray;
    if (m.index > pos) push({ kind: 'text', text: text.slice(pos, m.index) });
    if (best === 0) {
      const href = safeHref(m[2]);
      push(
        href
          ? {
              kind: 'link',
              href,
              external: href.startsWith('https:'),
              children: inline(m[1], depth + 1, budget),
            }
          : { kind: 'text', text: m[1] },
      );
    } else if (best === 1) {
      push({ kind: 'strong', children: inline(m[1], depth + 1, budget) });
    } else {
      push({ kind: 'em', children: inline(m[1] ?? m[2] ?? '', depth + 1, budget) });
    }
    pos = m.index + m[0].length;
  }
  if (pos < text.length) push({ kind: 'text', text: text.slice(pos) });
  return merge(out);
}

/** Adjacent text nodes joined (keeps the tree small). */
function merge(nodes: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.kind === 'text' && last?.kind === 'text')
      out[out.length - 1] = { kind: 'text', text: last.text + n.text };
    else out.push(n);
  }
  return out;
}

/** Markdown source → blocks. */
export function parseMarkdown(source: string | null | undefined, depth = 0): Block[] {
  const lines = (source ?? '').slice(0, MAX_SOURCE).replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const isBlank = (l: string) => l.trim() === '';
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = Math.min(
        4,
        Math.max(2, heading[1].length + (heading[1].length === 1 ? 1 : 0)),
      ) as 2 | 3 | 4;
      blocks.push({ kind: 'h', level, inlines: parseInline(heading[2]) });
      i++;
      continue;
    }
    if (/^\s{0,3}>/.test(line) && depth < MAX_DEPTH) {
      const inner: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i]))
        inner.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      blocks.push({ kind: 'quote', blocks: parseMarkdown(inner.join('\n'), depth + 1) });
      continue;
    }
    const bullet = /^\s{0,3}[-*+]\s+(.*)$/;
    const numbered = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;
    for (const [re, kind] of [
      [bullet, 'ul'],
      [numbered, 'ol'],
    ] as const) {
      if (re.test(line)) {
        const items: Inline[][] = [];
        while (i < lines.length && re.test(lines[i]))
          items.push(parseInline((re.exec(lines[i++]) as RegExpExecArray)[1]));
        blocks.push({ kind, items });
        break;
      }
    }
    if (i < lines.length && lines[i] === line && !bullet.test(line) && !numbered.test(line)) {
      const para: string[] = [];
      while (
        i < lines.length &&
        !isBlank(lines[i]) &&
        !/^\s{0,3}(#{1,6}\s|>|[-*+]\s|\d{1,9}[.)]\s)/.test(lines[i])
      )
        para.push(lines[i++].trim());
      if (para.length === 0) para.push(lines[i++].trim());
      blocks.push({ kind: 'p', inlines: parseInline(para.join(' ')) });
    }
  }
  return blocks;
}
