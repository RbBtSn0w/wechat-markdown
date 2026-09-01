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
    // Regression: grace/geek never declared .mac-code-wrapper or .gfm-alert*,
    // so with the defaults (macCodeBlock/gfmAlerts on) they emitted bare tags.
    const md = '```ts\nconst a = 1;\n```\n\n> [!NOTE]\n> A note.\n';

    for (const theme of ['grace', 'geek'] as const) {
      const result = await renderMarkdownToWechat(md, {
        theme,
        renderMath: false,
        renderMermaid: false,
      });
      expect(styleOf(result.html, 'section'), `${theme} mac wrapper`).toContain('background-color');
      expect(styleOf(result.html, 'blockquote'), `${theme} alert`).toContain('border-left');
    }
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
