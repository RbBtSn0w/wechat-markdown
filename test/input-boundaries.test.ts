import { describe, expect, it } from 'vitest';
import { load } from 'cheerio';
import { inlineWechatCss, renderMarkdownToWechat } from '../src';

const options = { renderMath: false, renderMermaid: false };

describe('input boundaries', () => {
  it.each(['engine', 'inliner'])(
    'keeps the article when a relative href is malformed (%s)',
    async (entry) => {
      const source = '<a href="/\\[">bad</a> after';
      const siteUrl = 'https://example.com';
      const html =
        entry === 'engine'
          ? (await renderMarkdownToWechat(source, { ...options, siteUrl })).html
          : inlineWechatCss(source, { siteUrl });
      const $ = load(html);
      expect($.text()).toContain('bad');
      expect($.text()).toContain('after');
      expect($('a').attr('href')).toBeUndefined();
    },
  );

  it.each(['', 'relative', 'javascript:alert(1)', 'https://user:pass@example.com'])(
    'rejects invalid siteUrl %j',
    async (siteUrl) => {
      await expect(renderMarkdownToWechat('body', { ...options, siteUrl })).rejects.toThrow(
        TypeError,
      );
    },
  );

  it('resolves root links against the origin while preserving protocol-relative links', async () => {
    const result = await renderMarkdownToWechat(
      '<a href="/docs?a=1&amp;b=2">local</a> <a href="//cdn.example.com/x">cdn</a>',
      { ...options, siteUrl: 'https://example.com/blog/', footnoteLinks: false },
    );
    expect(result.html).toContain('href="https://example.com/docs?a=1&amp;b=2"');
    expect(result.html).toContain('href="//cdn.example.com/x"');
  });

  it('does not abort rendering for a malformed body link with siteUrl', async () => {
    const result = await renderMarkdownToWechat('[bad](https://[) after', {
      ...options,
      siteUrl: 'https://example.com',
    });
    expect(result.html).toContain('bad');
    expect(result.html).toContain('after');
    expect(result.footnotes).toEqual([]);
  });

  it('classifies site links by origin rather than string prefix', async () => {
    const result = await renderMarkdownToWechat(
      '[internal](https://example.com/elsewhere) [external](https://example.com.evil.test/post)',
      { ...options, siteUrl: 'https://example.com/blog/' },
    );
    expect(result.footnotes.map((item) => item.url)).toEqual([
      'https://example.com.evil.test/post',
    ]);
  });

  it.each(['42', '- item', 'null'])(
    'rejects non-mapping YAML root %j but renders its body',
    async (root) => {
      const result = await renderMarkdownToWechat(
        `---\n${root}\n---\n# Body\n\nParagraph`,
        options,
      );
      expect(result.metadata).toEqual({});
      expect(result.title).toBe('Body');
      expect(result.html).toContain('Paragraph');
      expect(result.diagnostics.some((item) => item.code === 'FRONTMATTER_INVALID')).toBe(true);
    },
  );

  it('uses valid string metadata fields and reports invalid ones', async () => {
    const result = await renderMarkdownToWechat(
      '---\ntitle: 42\ndescription: []\ndigest: "Valid digest"\n---\n# Heading\n\nBody',
      options,
    );
    expect(result.title).toBe('Heading');
    expect(result.digest).toBe('Valid digest');
    expect(result.diagnostics.filter((item) => item.code === 'FRONTMATTER_INVALID')).toHaveLength(
      2,
    );
  });

  it('reports malformed YAML and preserves the original body fallback', async () => {
    const result = await renderMarkdownToWechat('---\ntitle: [broken\n---\nBody', options);
    expect(result.html).toContain('title: [broken');
    expect(result.diagnostics.some((item) => item.code === 'FRONTMATTER_INVALID')).toBe(true);
  });

  it('resolves each image occurrence with decoded source and alt without changing text or links', async () => {
    const calls: [string, string | undefined][] = [];
    const result = await renderMarkdownToWechat(
      '<img src="https://a.test/a?x=1&amp;y=2" alt="first"><img src="https://a.test/a?x=1&amp;y=2" alt="second">\n\nhttps://a.test/a?x=1&amp;y=2',
      {
        ...options,
        resolveImage: async (src, alt) => {
          calls.push([src, alt]);
          return `https://cdn.test/${calls.length}.png`;
        },
      },
    );
    expect(calls).toEqual([
      ['https://a.test/a?x=1&y=2', 'first'],
      ['https://a.test/a?x=1&y=2', 'second'],
    ]);
    expect(result.images).toEqual(calls.map(([src]) => src));
    expect(result.stats.images).toBe(2);
    expect(result.html).toContain('https://cdn.test/1.png');
    expect(result.html).toContain('https://cdn.test/2.png');
    expect(result.html).toContain('https://a.test/a?x=1&amp;y=2');
  });

  it('keeps images on empty resolver output or non-Error throws', async () => {
    let count = 0;
    const result = await renderMarkdownToWechat('![a](a.png) ![b](b.png)', {
      ...options,
      resolveImage: () => {
        if (++count === 1) return '';
        throw 'offline';
      },
    });
    expect(result.html).toContain('src="a.png"');
    expect(result.html).toContain('src="b.png"');
    expect(result.diagnostics[0].message).toContain('offline');
  });
});
