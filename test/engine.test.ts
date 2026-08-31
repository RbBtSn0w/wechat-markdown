import { describe, it, expect } from 'vitest';
import { renderMarkdownToWechat, WechatMarkdownEngine, getTheme, listThemes } from '../src';

describe('WechatMarkdownEngine Test Suite', () => {
  it('renders standard Markdown with front-matter into inline WeChat HTML', async () => {
    const md = `---
title: "Hello WeChat"
author: "Tester"
digest: "Summary text"
---

# Hello WeChat

This is a paragraph with **bold** text and \`code\`.

- Item 1
- Item 2
`;

    const result = await renderMarkdownToWechat(md, { theme: 'tech' });

    expect(result.title).toBe('Hello WeChat');
    expect(result.digest).toBe('Summary text');
    expect(result.html).toContain('style="');
    expect(result.html).not.toContain('class="');
    expect(result.html).not.toContain('id="');
    expect(result.html).toContain('Item 1');
    expect(result.html).toContain('Item 2');
  });

  it('supports multiple themes: grace and geek', async () => {
    const md = '# Title\n\nContent';

    const techResult = await renderMarkdownToWechat(md, { theme: 'tech' });
    const graceResult = await renderMarkdownToWechat(md, { theme: 'grace' });
    const geekResult = await renderMarkdownToWechat(md, { theme: 'geek' });

    expect(techResult.html).toContain('#0f4c81'); // tech blue
    expect(graceResult.html).toContain('#2d6a4f'); // grace green
    expect(geekResult.html).toContain('#1f2328'); // geek dark
  });

  it('supports custom resolveImage hook', async () => {
    const md = `![Image](https://example.com/photo.png)`;

    const result = await renderMarkdownToWechat(md, {
      resolveImage: async (src) => {
        return src.replace('https://example.com', 'https://mmbiz.qpic.cn');
      },
    });

    expect(result.html).toContain('https://mmbiz.qpic.cn/photo.png');
    expect(result.images).toContain('https://example.com/photo.png');
  });

  it('strips newlines in list items to prevent WeChat phantom bullets', async () => {
    const md = `- First item\n- Second item\n- Third item`;
    const result = await renderMarkdownToWechat(md);

    expect(result.html).not.toMatch(/<li>\s+/);
    expect(result.html).not.toMatch(/<\/li>\s+<\/ul>/);
  });

  it('lists registered themes properly', () => {
    const themes = listThemes();
    expect(themes.map((t) => t.name)).toEqual(expect.arrayContaining(['tech', 'grace', 'geek']));
  });
});
