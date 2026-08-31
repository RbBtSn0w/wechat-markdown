import { describe, it, expect } from 'vitest';
import { processMarkdownFootnotes, renderFootnotesHtml } from '../src/plugins/footnotes';
import { decorateCodeBlocks } from '../src/plugins/code-decorator';
import { wrapTablesWithScroller } from '../src/plugins/table-scroller';
import { processGfmAlerts } from '../src/plugins/alerts';

describe('Plugins Test Suite', () => {
  describe('Footnotes Plugin', () => {
    it('extracts external links and converts them to numbered footnotes', () => {
      const input = 'Check out [Google](https://google.com) and [GitHub](https://github.com). Local link: [About](/about).';
      const result = processMarkdownFootnotes(input, 'https://myblog.com');

      expect(result.footnotes).toHaveLength(2);
      expect(result.footnotes[0]).toEqual({
        index: 1,
        title: 'Google',
        url: 'https://google.com',
      });
      expect(result.footnotes[1]).toEqual({
        index: 2,
        title: 'GitHub',
        url: 'https://github.com',
      });
      expect(result.markdown).toContain('Google<sup class="footnote-ref">[1]</sup>');
      expect(result.markdown).toContain('GitHub<sup class="footnote-ref">[2]</sup>');
      expect(result.markdown).toContain('[About](/about)');
    });

    it('renders footnotes section html correctly', () => {
      const footnotes = [
        { index: 1, title: 'Google', url: 'https://google.com' },
      ];
      const html = renderFootnotesHtml(footnotes);
      expect(html).toContain('footnotes-container');
      expect(html).toContain('参考链接');
      expect(html).toContain('[1]');
      expect(html).toContain('https://google.com');
    });
  });

  describe('Code Decorator Plugin', () => {
    it('wraps pre/code with Mac style header and dots', () => {
      const html = '<pre><code class="language-typescript">const a = 1;</code></pre>';
      const decorated = decorateCodeBlocks(html, true);

      expect(decorated).toContain('mac-code-wrapper');
      expect(decorated).toContain('mac-dots');
      expect(decorated).toContain('mac-dot-red');
      expect(decorated).toContain('TYPESCRIPT');
      expect(decorated).toContain('const a = 1;');
    });
  });

  describe('Table Scroller Plugin', () => {
    it('wraps table elements in table-scroller section', () => {
      const html = '<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Val</td></tr></tbody></table>';
      const wrapped = wrapTablesWithScroller(html, true);

      expect(wrapped).toContain('<section class="table-scroller"><table>');
      expect(wrapped).toContain('</table></section>');
    });
  });

  describe('GFM Alerts Plugin', () => {
    it('transforms GFM blockquote alerts into stylized callouts', () => {
      const html = '<blockquote><p>[!NOTE] This is a note</p></blockquote>';
      const transformed = processGfmAlerts(html, true);

      expect(transformed).toContain('gfm-alert gfm-alert-note');
      expect(transformed).toContain('gfm-alert-title');
      expect(transformed).toContain('Note');
      expect(transformed).toContain('This is a note');
    });
  });
});
