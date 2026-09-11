import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { WechatMarkdownEngine } from '../src';

describe('Markdown Comprehensive Coverage Suite', () => {
  const engine = new WechatMarkdownEngine();

  describe('1. Code Blocks & Inlining Variations', () => {
    it('handles standard fenced code blocks with language', async () => {
      const md = '```typescript\nconst greeting: string = "hello";\n```';
      const res = await engine.render(md, { macCodeBlock: true });
      expect(res.html).toContain('white-space: pre !important');
      expect(res.html).toContain('overflow-x: auto !important');
      expect(res.html).toContain('TYPESCRIPT'); // normalized lang display
      expect(res.html).toContain('#ff5f56'); // Mac dots
    });

    it('handles fenced code blocks without language tag', async () => {
      const md = '```\ngeneric unlabelled text\n```';
      const res = await engine.render(md, { macCodeBlock: true });
      expect(res.html).toContain('white-space: pre !important');
      expect(res.html).toContain('CODE');
      expect(res.html).toContain('generic unlabelled text');
    });

    it('handles 4-space indented code blocks', async () => {
      const md = 'Regular paragraph\n\n    def foo():\n        return 42\n';
      const res = await engine.render(md, { macCodeBlock: true });
      expect(res.html).toContain('white-space: pre !important');
      expect(res.html).toContain('def foo');
    });

    it('handles tilde fenced code blocks (~~~)', async () => {
      const md = '~~~python\nprint("tilde")\n~~~';
      const res = await engine.render(md, { macCodeBlock: true });
      expect(res.html).toContain('white-space: pre !important');
      expect(res.html).toContain('PYTHON');
    });

    it('handles code blocks containing special HTML characters', async () => {
      const md = '```html\n<div class="test" id=\'box\'>& "hello"</div>\n```';
      const res = await engine.render(md, { macCodeBlock: true });
      expect(res.html).toContain('&lt;');
      expect(res.html).toContain('&amp;');
    });

    it('handles code blocks with extra info strings', async () => {
      const md = '```swift title="AppDelegate.swift"\nfunc application() {}\n```';
      const res = await engine.render(md, { macCodeBlock: true });
      expect(res.html).toContain('white-space: pre !important');
      expect(res.html).toContain('SWIFT');
    });

    it('keeps inline code isolated from pre code styling', async () => {
      const md = 'Here is `inline code` inside a paragraph.';
      const res = await engine.render(md, { macCodeBlock: true });
      expect(res.html).toContain('<code');
      // inline code must not have display: block !important
      expect(res.html).not.toMatch(/<code[^>]*style="[^"]*display:\s*block/);
    });
  });

  describe('2. Tables, Lists, & Quotes', () => {
    it('handles complex tables with alignment', async () => {
      const md = `
| Feature | Supported | Notes |
| :--- | :---: | ---: |
| Fenced Code | Yes | Mac style |
| Math | Yes | LaTeX |
`;
      const res = await engine.render(md, { tableScroller: true });
      expect(res.html).toContain('<table');
      expect(res.html).toContain('overflow-x: auto');
      expect(res.html).toContain('Fenced Code');
    });

    it('handles nested ordered and unordered lists without phantom bullets', async () => {
      const md = `
- Parent 1
  - Child 1.1
  - Child 1.2
- Parent 2
  1. Numbered 2.1
  2. Numbered 2.2
`;
      const res = await engine.render(md);
      expect(res.html).toContain('Parent 1');
      expect(res.html).toContain('Child 1.1');
      expect(res.html).not.toMatch(/<li>\s+/);
    });

    it('handles GFM task lists (checked and unchecked)', async () => {
      const md = `
- [x] Finished task
- [ ] Pending task
`;
      const res = await engine.render(md, { taskLists: true });
      expect(res.html).toContain('✓');
      expect(res.html).not.toContain('<input');
    });

    it('handles nested blockquotes', async () => {
      const md = `
> Level 1 quote
>> Nested Level 2 quote
`;
      const res = await engine.render(md);
      expect(res.html).toContain('Level 1 quote');
      expect(res.html).toContain('Nested Level 2 quote');
    });
  });

  describe('3. GFM Alerts & Media', () => {
    it('handles all 5 GFM alert types', async () => {
      const md = `
> [!NOTE]
> Useful note

> [!TIP]
> Handy tip

> [!IMPORTANT]
> Critical info

> [!WARNING]
> Warning beware

> [!CAUTION]
> Dangerous action
`;
      const res = await engine.render(md, { gfmAlerts: true });
      expect(res.html).toContain('Note');
      expect(res.html).toContain('Tip');
      expect(res.html).toContain('Important');
      expect(res.html).toContain('Warning');
      expect(res.html).toContain('Caution');
    });

    it('handles image figure with caption and prevents Setext collision', async () => {
      const md = `
![Architecture Flow](/assets/img/flow.png "System Flow")

---
## Next Section
`;
      const res = await engine.render(md, { imageFigures: true });
      expect(res.html).toContain('System Flow');
      // Verify no Setext h2 wrapping the image
      expect(res.html).not.toMatch(/<h2[^>]*>\s*<img/i);
    });
  });

  describe('4. Links & Footnotes', () => {
    it('preserves native mp.weixin.qq.com links and footnotes external links', async () => {
      const md = `
[WeChat Official](https://mp.weixin.qq.com/s/sample)
[GitHub](https://github.com/rbbtsn0w)
`;
      const res = await engine.render(md, { footnoteLinks: true });
      expect(res.html).toContain('href="https://mp.weixin.qq.com/s/sample"');
      expect(res.html).toContain('github.com/rbbtsn0w');
    });
  });

  describe('5. Liquid / Jekyll Template Syntax Compatibility', () => {
    it('handles raw liquid blocks safely', async () => {
      const md = `
{% raw %}
\`\`\`bash
echo "\${{ secrets.GITHUB_TOKEN }}"
\`\`\`
{% endraw %}
`;
      const res = await engine.render(md, { macCodeBlock: true });
      expect(res.html).toContain('GITHUB_TOKEN');
      expect(res.html).toContain('white-space: pre !important');
    });
  });

  describe('6. Entire Blog Corpus (76 Posts) Full Regression Test', () => {
    const postsDir = path.resolve(__dirname, '../../rbbtsn0w.github.io/_posts');
    const hasPosts = fs.existsSync(postsDir);

    it.skipIf(!hasPosts)(
      'renders all blog posts without throwing or generating broken code tags',
      async () => {
        const files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md'));
        expect(files.length).toBeGreaterThanOrEqual(70);

        for (const file of files) {
          const fullPath = path.join(postsDir, file);
          const content = fs.readFileSync(fullPath, 'utf8');

          const res = await engine.render(content, {
            theme: 'tech',
            highlightTheme: 'atom-one-dark',
            macCodeBlock: true,
            imageFigures: true,
            renderMermaid: false, // skip remote network calls in unit test
          });

          // 1. Output HTML should not be empty
          expect(res.html.length).toBeGreaterThan(0);

          // 2. Must not produce Setext h2 around images
          expect(res.html).not.toMatch(/<h2[^>]*>\s*<img/i);

          // 3. Every <pre> tag must have white-space: pre !important
          const preMatches = [...res.html.matchAll(/<pre\b([^>]*)>/g)];
          for (const p of preMatches) {
            expect(p[1]).toContain('white-space: pre !important');
          }
        }
      },
    );
  });
});
