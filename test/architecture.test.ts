import { describe, it, expect } from 'vitest';
import {
  renderMarkdownToWechat,
  FormulaRenderService,
  MermaidRenderService,
  ThemeConfig,
} from '../src';

/** Pull the style attribute of the first tag matching `selector` (a tag name plus optional attribute substring). */
function styleOf(html: string, tag: string, marker?: string): string {
  const re = new RegExp(`<${tag}\\s[^>]*>`, 'g');
  for (const match of html.match(re) ?? []) {
    if (!marker || match.includes(marker)) {
      return /\sstyle="([^"]*)"/.exec(match)?.[1] ?? '';
    }
  }
  return '';
}

const fakeFormula: FormulaRenderService = {
  renderToImage: (expr, display) =>
    `https://mmbiz.qpic.cn/${display ? 'block' : 'inline'}-${encodeURIComponent(expr)}.png`,
};

const fakeMermaid: MermaidRenderService = {
  renderToImage: () => 'https://mmbiz.qpic.cn/diagram.png',
};

describe('capability base CSS layering', () => {
  it('lets the theme override base CSS while base-only properties survive', async () => {
    // Base declares background-color AND overflow for .mac-code-wrapper; this
    // theme redeclares only the background.
    const theme: ThemeConfig = {
      name: 'brand-only',
      css: '.mac-code-wrapper { background-color: #ffffff; }',
    };
    const result = await renderMarkdownToWechat('```ts\nconst a = 1;\n```', {
      theme,
      renderMath: false,
      renderMermaid: false,
    });

    const style = styleOf(result.html, 'section');
    expect(style).toContain('background-color: #ffffff');
    expect(style).not.toContain('#282c34');
    // base-only property still applied
    expect(style).toContain('overflow: hidden');
  });

  it('styles capability markup for themes that define none of it', async () => {
    // Regression: grace/geek emitted bare tags for markup they declared no
    // rules for. They now carry their own .gfm-alert* palettes, so only
    // .mac-code-wrapper still exercises the base path through a built-in theme.
    const md = '```ts\nconst a = 1;\n```';

    for (const theme of ['grace', 'geek'] as const) {
      const result = await renderMarkdownToWechat(md, {
        theme,
        renderMath: false,
        renderMermaid: false,
      });
      expect(styleOf(result.html, 'section'), `${theme} mac wrapper`).toContain('background-color');
    }

    // No built-in theme leaves alerts to the base layer any more, so the
    // base-alert path needs a theme that declares nothing about them.
    const bare = await renderMarkdownToWechat('> [!NOTE]\n> A note.\n', {
      theme: { name: 'bare', css: '.markdown-body { color: #111111; }' },
      renderMath: false,
      renderMermaid: false,
    });
    expect(styleOf(bare.html, 'blockquote')).toContain('background-color: #ddf4ff');
  });

  it('gives each GFM alert type its own colors under a theme that styles blockquotes', async () => {
    // Regression: base and tech both declared a bare `.gfm-alert-note` (0,1,0),
    // which lost to tech's `.markdown-body blockquote` (0,1,1). All five alert
    // types collapsed onto the same generic blockquote look. `class` is
    // stripped by cleanWechatAttributes, so each type is rendered separately
    // rather than picked out of one document.
    const styleFor = async (type: string) => {
      const result = await renderMarkdownToWechat(`> [!${type}]\n> Body.\n`, {
        theme: 'tech',
        renderMath: false,
        renderMermaid: false,
      });
      return styleOf(result.html, 'blockquote');
    };

    const note = await styleFor('NOTE');
    const warning = await styleFor('WARNING');

    expect(note).toContain('background-color: #ddf4ff');
    expect(warning).toContain('background-color: #fff8c5');
    expect(note).not.toBe(warning);

    // the per-type border color must land after the border-left shorthand,
    // or the shorthand silently resets it
    expect(note.indexOf('border-left-color: #0969da')).toBeGreaterThan(
      note.indexOf('border-left:'),
    );
  });

  it('keeps all five alert types visually distinct in every built-in theme', async () => {
    // Each theme hand-writes five hex pairs; a copy-paste typo that gives two
    // types the same color is exactly what collapses alerts back together.
    // Compare the *effective* colors, not the style string -- an alert always
    // carries an extra border-left-color, so string equality never fires.
    const types = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const;

    /** background plus the border color that actually wins, shorthand or longhand. */
    const colorsOf = (style: string) => {
      const bg = /background-color:\s*([^;]+)/.exec(style)?.[1]?.trim();
      const longhand = /border-left-color:\s*([^;]+)/.exec(style)?.[1]?.trim();
      const shorthand = /border-left:[^;]*?(#[0-9a-f]{3,8})/i.exec(style)?.[1];
      return `${bg} | ${longhand ?? shorthand}`;
    };

    const quoteStyle = async (md: string, theme: string) => {
      const result = await renderMarkdownToWechat(md, {
        theme,
        renderMath: false,
        renderMermaid: false,
      });
      return styleOf(result.html, 'blockquote');
    };

    // each theme's own .gfm-alert fallback color -- asserting it proves the
    // theme layer still outranks the base layer (whose fallback is #57606a).
    // Without this, un-scoping a theme's alert rules would go unnoticed: base
    // would take over and still produce five distinct types.
    const brandBorder = { tech: '#0f4c81', grace: '#52b788', geek: '#fd7e14' } as const;

    for (const theme of ['tech', 'grace', 'geek'] as const) {
      const seen: string[] = [];
      for (const type of types) {
        const style = await quoteStyle(`> [!${type}]\n> Body.\n`, theme);
        expect(style, `${theme} ${type} theme layer`).toContain(
          `border-left: 4px solid ${brandBorder[theme]}`,
        );

        // a per-type border color emitted before the border-left shorthand
        // would be silently reset by it
        expect(style.indexOf('border-left-color:'), `${theme} ${type} order`).toBeGreaterThan(
          style.indexOf('border-left:'),
        );
        const colors = colorsOf(style);
        expect(colors, `${theme} ${type} colors`).not.toContain('undefined');
        seen.push(colors);
      }

      expect(new Set(seen).size, `${theme} distinct alert colors`).toBe(types.length);

      // and none of them may collide with the theme's own plain blockquote
      const plain = colorsOf(await quoteStyle('> Plain quote.\n', theme));
      expect(seen, `${theme} vs plain quote`).not.toContain(plain);
    }
  });

  it('leaves plain blockquotes on the theme rule and keeps the theme above base', async () => {
    const result = await renderMarkdownToWechat('> Plain quote.\n', {
      theme: 'tech',
      renderMath: false,
      renderMermaid: false,
    });
    // scoping the alert rules must not have pulled in ordinary blockquotes
    expect(styleOf(result.html, 'blockquote')).toContain('background-color: #f0f6fa');

    // tech redeclares .gfm-alert's border-left as #0f4c81 over base's #57606a;
    // if scoping had inverted the layering, base would win here instead
    const alert = await renderMarkdownToWechat('> [!NOTE]\n> Body.\n', {
      theme: 'tech',
      renderMath: false,
      renderMermaid: false,
    });
    expect(styleOf(alert.html, 'blockquote')).toContain('border-left: 4px solid #0f4c81');
  });

  it('keeps formula images scoped above the theme .markdown-body img rule', async () => {
    // tech declares `.markdown-body img { display: block; max-width: 100% }`
    // (0,1,1). A bare `.wm-formula-inline` (0,1,0) would lose to it and break
    // inline formulas out of their paragraph.
    const result = await renderMarkdownToWechat('Inline $E=mc^2$ and\n\n$$a^2+b^2=c^2$$\n', {
      theme: 'tech',
      renderMermaid: false,
      services: { formulaRenderer: fakeFormula },
    });

    const inline = styleOf(result.html, 'img', 'inline-E');
    expect(inline).toContain('display: inline-block');
    expect(inline).toContain('max-height: 1.4em');

    const block = styleOf(result.html, 'img', 'block-a');
    expect(block).toContain('max-width: 90%');
    expect(block).not.toContain('max-width: 100%');

    // the theme's own img rule still contributes what base leaves undeclared
    expect(inline).toContain('border-radius: 6px');
  });

  it('styles mermaid figures through the base layer', async () => {
    const result = await renderMarkdownToWechat('```mermaid\ngraph TD\n  A-->B\n```', {
      theme: 'tech',
      renderMath: false,
      services: { mermaidRenderer: fakeMermaid },
    });

    expect(styleOf(result.html, 'img', 'diagram.png')).toContain('display: block');
    expect(styleOf(result.html, 'p', 'text-align')).toContain('text-align: center');
  });

  it('omits base CSS for disabled capabilities', async () => {
    const result = await renderMarkdownToWechat('| a | b |\n| --- | --- |\n| 1 | 2 |', {
      theme: 'tech',
      tableScroller: false,
      renderMath: false,
      renderMermaid: false,
    });

    expect(result.html).not.toContain('overflow-x: auto');
  });
});

describe('render service injection', () => {
  it('substitutes the string an injected formula renderer returns, verbatim', async () => {
    const result = await renderMarkdownToWechat('$$E=mc^2$$', {
      renderMermaid: false,
      services: { formulaRenderer: fakeFormula },
    });

    expect(result.html).toContain('https://mmbiz.qpic.cn/block-E%3Dmc%5E2.png');
    expect(result.stats.formulas).toBe(1);
  });

  it('substitutes the string an injected mermaid renderer returns, verbatim', async () => {
    const result = await renderMarkdownToWechat('```mermaid\ngraph TD\n  A-->B\n```', {
      renderMath: false,
      services: { mermaidRenderer: fakeMermaid },
    });

    expect(result.html).toContain('https://mmbiz.qpic.cn/diagram.png');
    expect(result.stats.mermaid).toBe(1);
  });

  it('degrades to a code block when an injected mermaid renderer throws', async () => {
    const result = await renderMarkdownToWechat('```mermaid\ngraph TD\n  A-->B\n```', {
      renderMath: false,
      services: {
        mermaidRenderer: {
          renderToImage: () => {
            throw new Error('boom');
          },
        },
      },
    });

    expect(result.stats.mermaid).toBe(0);
    expect(result.diagnostics.map((d) => d.code)).toContain('MERMAID_RENDER_FAILED');
    expect(result.html).toContain('graph TD');
  });
});

describe('theme resolution', () => {
  it('accepts a ThemeConfig object without touching the global registry', async () => {
    const result = await renderMarkdownToWechat('# Title', {
      theme: { name: 'inline-brand', css: '.markdown-body h1 { color: #123456; }' },
      renderMath: false,
      renderMermaid: false,
    });

    expect(result.html).toContain('#123456');
  });

  it('falls back to the default theme for unknown names rather than throwing', async () => {
    // Downstream configs carry unregistered names and rely on this fallback.
    const result = await renderMarkdownToWechat('# Title', {
      theme: 'default',
      renderMath: false,
      renderMermaid: false,
    });

    expect(result.html).toContain('#0f4c81');
  });
});
