import { describe, expect, it } from 'vitest';
import { load } from 'cheerio';
import { renderMarkdownToWechat } from '../src';

describe('Markdown token boundaries', () => {
  it.each(['typescript title="example"', 'unknown-language', ''])(
    'renders fenced code text safely through renderer tokens: %j',
    async (info) => {
      const code = 'const value = "<script>";\nconsole.log(value);';
      const result = await renderMarkdownToWechat('```' + info + '\n' + code + '\n```', {
        renderMath: false,
        renderMermaid: false,
        macCodeBlock: false,
      });
      const $ = load(result.html);
      expect($('pre code').text()).toContain('const value = "<script>";');
      expect($('pre code').text()).toContain('console.log(value);');
      expect($('script')).toHaveLength(0);
      expect(result.html).not.toContain('[object Object]');
    },
  );

  it.each([
    'Before\n$$\nx+y\n$$\nAfter',
    '> Before\n> $$\n> x+y\n> $$\n> After',
    '- Before\n  $$\n  x+y\n  $$\n  After',
  ])('renders a block formula without surrounding blank lines: %j', async (markdown) => {
    const calls: [string, boolean][] = [];
    const result = await renderMarkdownToWechat(markdown, {
      renderMermaid: false,
      services: {
        formulaRenderer: {
          renderToImage: (expression, display) => {
            calls.push([expression, display]);
            return '/formula.png';
          },
        },
      },
    });
    expect(calls).toEqual([['x+y', true]]);
    expect(result.stats.formulas).toBe(1);
    expect(load(result.html).text()).toContain('After');
  });

  it('preserves Markdown formatting inside inline HTML while excluding its formulas', async () => {
    const calls: string[] = [];
    const result = await renderMarkdownToWechat(
      'Before <span>**bold** *italic* `code` ![image](/photo.png) $html$</span> after $prose$',
      {
        footnoteLinks: false,
        renderMermaid: false,
        services: {
          formulaRenderer: {
            renderToImage: (expression) => {
              calls.push(expression);
              return '/formula.png';
            },
          },
        },
      },
    );
    const $ = load(result.html);
    expect($('strong').text()).toBe('bold');
    expect($('em').text()).toBe('italic');
    expect($('code').text()).toBe('code');
    expect($('img[src="/photo.png"]').attr('alt')).toBe('image');
    expect($.text()).toContain('$html$');
    expect(calls).toEqual(['prose']);
  });

  it('retains content and formula scope across a long sequence of void HTML elements', async () => {
    const calls: string[] = [];
    const result = await renderMarkdownToWechat(
      'Before ' + '<br>'.repeat(6000) + ' **after** $x$',
      {
        renderMermaid: false,
        services: {
          formulaRenderer: {
            renderToImage: (expression) => {
              calls.push(expression);
              return '/formula.png';
            },
          },
        },
      },
    );
    const $ = load(result.html);
    expect($('br')).toHaveLength(6000);
    expect($('strong').text()).toBe('after');
    expect(calls).toEqual(['x']);
  });

  it.each([
    'Before <span>**bold $inside$**\n$$\nblock\n$$\n</span> after $outside$',
    'Before <span>$unclosed</span> after $outside$',
    'Before <span><BR><img src="/photo.png"/>$inside$</span> after $outside$',
    'Before <span>\n\n$inside$\n\n</span>\n\nafter $outside$',
    '<span>\n\n$$\ninside\n$$\n\n</span>\n\nafter $outside$',
  ])('keeps formula scope across Markdown and HTML tokens: %j', async (markdown) => {
    const calls: string[] = [];
    const result = await renderMarkdownToWechat(markdown, {
      renderMermaid: false,
      services: {
        formulaRenderer: {
          renderToImage: (expression) => {
            calls.push(expression);
            return '/formula.png';
          },
        },
      },
    });
    expect(calls).toEqual(['outside']);
    expect(load(result.html).text()).toContain('after');
  });

  it('renders math only in Markdown prose, skipping code, escapes and raw HTML', async () => {
    const calls: [string, boolean][] = [];
    const result = await renderMarkdownToWechat(
      '`$code$`\n\n```text\n$block$\n```\n\n\\$escaped$\n\n<span>$html$</span>\n\n$inline$\n\n$$\ndisplay\n$$',
      {
        renderMermaid: false,
        services: {
          formulaRenderer: {
            renderToImage: (expression, display) => {
              calls.push([expression, display]);
              return '/formula.png';
            },
          },
        },
      },
    );
    expect(calls).toEqual([
      ['inline', false],
      ['display', true],
    ]);
    expect(result.stats.formulas).toBe(2);
    expect(result.html).toContain('$code$');
    expect(result.html).toContain('$html$');
  });

  it('keeps nested raw HTML regions opaque to math', async () => {
    const calls: string[] = [];
    const result = await renderMarkdownToWechat(
      'Before <span>$a$<span>$b$</span>$c$</span> after $d$',
      {
        renderMermaid: false,
        services: {
          formulaRenderer: {
            renderToImage: (expression) => {
              calls.push(expression);
              return '/formula.png';
            },
          },
        },
      },
    );
    expect(calls).toEqual(['d']);
    expect(result.html).toContain('$c$');
  });

  it('ignores apparent HTML closing tags in comments while skipping raw HTML math', async () => {
    const calls: string[] = [];
    const result = await renderMarkdownToWechat(
      'Before <span><!-- </span> -->$x$</span> after $y$',
      {
        renderMermaid: false,
        services: {
          formulaRenderer: {
            renderToImage: (expression) => {
              calls.push(expression);
              return '/formula.png';
            },
          },
        },
      },
    );
    expect(calls).toEqual(['y']);
    expect(result.html).toContain('$x$');
    expect(result.html).toContain('after');
  });

  it('uses escape parity for inline and block math closing delimiters', async () => {
    const calls: [string, boolean][] = [];
    await renderMarkdownToWechat(
      String.raw`Cost $x + \$5$ done` +
        '\n\n' +
        String.raw`$$x \$$ y$$` +
        '\n\n' +
        String.raw`Even $x\\$ done`,
      {
        renderMermaid: false,
        services: {
          formulaRenderer: {
            renderToImage: (expression, display) => {
              calls.push([expression, display]);
              return '/formula.png';
            },
          },
        },
      },
    );
    expect(calls).toEqual([
      [String.raw`x + \$5`, false],
      [String.raw`x \$$ y`, true],
      [String.raw`x\\`, false],
    ]);
  });

  it('renders Mermaid from tilde and longer fences while preserving nested code samples', async () => {
    const codes: string[] = [];
    const result = await renderMarkdownToWechat(
      '~~~mermaid\ngraph TD; A-->B\n~~~\n\n````mermaid\ngraph LR; C-->D\n````\n\n`````text\n```mermaid\ngraph TD; sample\n```\n`````',
      {
        renderMath: false,
        services: {
          mermaidRenderer: {
            renderToImage: (code) => {
              codes.push(code);
              return '/diagram.png';
            },
          },
        },
      },
    );
    expect(codes).toEqual(['graph TD; A-->B', 'graph LR; C-->D']);
    expect(result.stats.mermaid).toBe(2);
    expect(result.html).toContain('sample');
  });

  it('preserves failed formulas and safely escapes failed Mermaid code', async () => {
    const result = await renderMarkdownToWechat(
      '$x$\n\n~~~mermaid\n<img src=x onerror=alert(1)>\n~~~',
      {
        services: {
          formulaRenderer: {
            renderToImage: () => {
              throw 'math unavailable';
            },
          },
          mermaidRenderer: {
            renderToImage: () => {
              throw 'diagram unavailable';
            },
          },
        },
      },
    );
    expect(result.stats.formulas).toBe(0);
    expect(result.stats.mermaid).toBe(0);
    expect(result.html).toContain('$x$');
    expect(result.html).toContain('&lt;img');
    expect(result.diagnostics.map((item) => item.message).join(' ')).toContain(
      'diagram unavailable',
    );
  });
});

it('keeps currency prose out of inline TeX delimiters', async () => {
  const calls: string[] = [];
  const formulaRenderer = {
    renderToImage: (expression: string) => {
      calls.push(expression);
      return '/formula.png';
    },
  };
  const result = await renderMarkdownToWechat('costs $5 and $10; $ spaced $; $x$10', {
    services: { formulaRenderer },
  });
  expect(calls).toEqual([]);
  expect(result.html).toContain('costs $5 and $10');
});
