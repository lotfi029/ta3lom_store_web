import {
  type Block,
  type Inline,
  MAX_SOURCE,
  parseInline,
  parseMarkdown,
  safeHref,
} from './markdown';

/** Every href in a tree. */
function hrefs(blocks: Block[]): string[] {
  const out: string[] = [];
  const walk = (ns: Inline[]) =>
    ns.forEach((n) => {
      if (n.kind === 'link') out.push(n.href);
      if (n.kind !== 'text') walk(n.children);
    });
  for (const b of blocks) {
    if (b.kind === 'p' || b.kind === 'h') walk(b.inlines);
    else if (b.kind === 'quote') out.push(...hrefs(b.blocks));
    else b.items.forEach(walk);
  }
  return out;
}
/** The text the reader sees. */
function text(blocks: Block[]): string {
  const t = (ns: Inline[]): string =>
    ns.map((n) => (n.kind === 'text' ? n.text : t(n.children))).join('');
  return blocks
    .map((b) =>
      b.kind === 'p' || b.kind === 'h'
        ? t(b.inlines)
        : b.kind === 'quote'
          ? text(b.blocks)
          : b.items.map(t).join('|'),
    )
    .join('\n');
}

describe('markdown subset (C-5)', () => {
  it('parses paragraphs, h2–h4, lists, quotes, strong, em and links', () => {
    const b = parseMarkdown(
      '# Title\n## Sub\n#### Deep\nline one\nline two\n\n- a\n- **b**\n\n1. x\n2. _y_\n\n> quoted [site](https://ta3lom.sa)\n\nmail [us](mailto:store@ta3lom.sa)',
    );
    expect(b.map((x) => x.kind)).toEqual(['h', 'h', 'h', 'p', 'ul', 'ol', 'quote', 'p']);
    expect(b.slice(0, 3).map((x) => (x as { level: number }).level)).toEqual([2, 2, 4]);
    expect(text([b[3]])).toBe('line one line two');
    expect(hrefs(b)).toEqual(['https://ta3lom.sa/', 'mailto:store@ta3lom.sa']);
    expect(parseInline('a **b *c* d** e')).toEqual([
      { kind: 'text', text: 'a ' },
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'b ' },
          { kind: 'em', children: [{ kind: 'text', text: 'c' }] },
          { kind: 'text', text: ' d' },
        ],
      },
      { kind: 'text', text: ' e' },
    ]);
  });

  it('keeps only https and mailto links — XSS vectors become plain text', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'javascript&#58;alert(1)',
      'javascript%3Aalert(1)',
      '&#106;avascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      'http://insecure.example',
      '//evil.example',
      '/relative',
      'https:\\\\evil.example',
      'mailto:',
    ])
      expect(safeHref(bad), bad).toBeNull();
    const b = parseMarkdown('[click](javascript:alert(1)) [x](data:text/html,1) [y](vbscript:1)');
    expect(hrefs(b)).toEqual([]);
    expect(text(b)).toContain('click');
  });

  it('never produces HTML: tags and attributes stay literal text', () => {
    const src =
      '<script>alert(1)</script> <img src=x onerror=alert(1)> <a href="javascript:x">y</a>';
    const b = parseMarkdown(src);
    expect(b).toEqual([{ kind: 'p', inlines: [{ kind: 'text', text: src }] }]);
  });

  it('nested brackets and broken markup stay text', () => {
    expect(hrefs(parseMarkdown('[a [b] c](https://x.example)'))).toEqual([]);
    expect(text(parseMarkdown('**not closed and [no link]('))).toBe('**not closed and [no link](');
  });

  it('handles very long input quickly and caps it', () => {
    const long = `${'*'.repeat(30_000)}\n${'['.repeat(10_000)}${'('.repeat(10_000)}`;
    const t0 = Date.now();
    const b = parseMarkdown(long);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(text(b).length).toBeLessThanOrEqual(MAX_SOURCE);
  });
});

describe('inline parsing cost (F-8)', () => {
  const count = (nodes: Inline[]): number =>
    nodes.reduce((n, x) => n + 1 + (x.kind === 'text' ? 0 : count(x.children)), 0);
  const text = (nodes: Inline[]): string =>
    nodes.map((x) => (x.kind === 'text' ? x.text : text(x.children))).join('');

  it('20,000 characters of "**a** " parse in under 50 ms, at most 500 nodes, no visible text lost', () => {
    const source = '**a** '.repeat(3334).slice(0, MAX_SOURCE);
    const t0 = performance.now();
    const nodes = parseInline(source);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(50);
    expect(count(nodes)).toBeLessThanOrEqual(500);
    // The first blocks are bold, the rest after the cap stays as plain text — nothing dropped.
    expect(nodes[0]).toEqual({ kind: 'strong', children: [{ kind: 'text', text: 'a' }] });
    const visible = text(nodes);
    const strongCount = nodes.filter((n) => n.kind === 'strong').length;
    expect(visible.length).toBe(source.length - 4 * strongCount);
    expect(visible.endsWith(source.slice(-20))).toBe(true);
  });

  it('keeps the same tree for ordinary text (links, strong, em, nesting)', () => {
    expect(parseInline('a **b *c* d** [x](https://x.example) _e_ and *f')).toEqual([
      { kind: 'text', text: 'a ' },
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'b ' },
          { kind: 'em', children: [{ kind: 'text', text: 'c' }] },
          { kind: 'text', text: ' d' },
        ],
      },
      { kind: 'text', text: ' ' },
      {
        kind: 'link',
        href: 'https://x.example/',
        external: true,
        children: [{ kind: 'text', text: 'x' }],
      },
      { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'e' }] },
      { kind: 'text', text: ' and *f' },
    ]);
  });
});
