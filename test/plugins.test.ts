import { describe, it, expect } from 'vitest';
import { processMarkdownFootnotes, renderFootnotesHtml } from '../src/plugins/footnotes';
import { decorateCodeBlocks } from '../src/plugins/code-decorator';
import { highlightCode } from '../src/plugins/highlighter';
import { wrapTablesWithScroller } from '../src/plugins/table-scroller';
import { processGfmAlerts } from '../src/plugins/alerts';
import { processTaskLists } from '../src/plugins/task-list';
import { processImageFigures } from '../src/plugins/image-figure';

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

    it('preserves native mp.weixin.qq.com links without turning them into footnotes', () => {
      const input = 'Read the [Official Post](https://mp.weixin.qq.com/s/abcdef123) for details.';
      const result = processMarkdownFootnotes(input, 'https://myblog.com');

      expect(result.footnotes).toHaveLength(0);
      expect(result.markdown).toBe(input);
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

    it('normalizes common language aliases to standardized labels', () => {
      const cases = [
        { html: '<pre><code class="language-js">console.log(1)</code></pre>', expected: 'JAVASCRIPT' },
        { html: '<pre><code class="language-py">print(1)</code></pre>', expected: 'PYTHON' },
        { html: '<pre><code class="language-sh">echo hello</code></pre>', expected: 'SHELL' },
        { html: '<pre><code class="language-cpp">int main() {}</code></pre>', expected: 'C++' },
        { html: '<pre><code class="language-rs">fn main() {}</code></pre>', expected: 'RUST' },
        { html: '<pre><code class="language-yml">foo: bar</code></pre>', expected: 'YAML' },
      ];

      for (const { html, expected } of cases) {
        const decorated = decorateCodeBlocks(html, true);
        expect(decorated).toContain(`<span class="mac-code-lang">${expected}</span>`);
      }
    });

    it('handles untagged and indented code blocks gracefully with fallback label', () => {
      const html = '<pre><code>plain text without language</code></pre>';
      const decorated = decorateCodeBlocks(html, true);

      expect(decorated).toContain('mac-code-wrapper');
      expect(decorated).toContain('<span class="mac-code-lang">CODE</span>');
      expect(decorated).toContain('plain text without language');
    });

    it('handles code blocks with extra attributes or titles', () => {
      const html = '<pre><code class="language-swift" title="AppDelegate.swift" data-line="1">let x = 1</code></pre>';
      const decorated = decorateCodeBlocks(html, true);

      expect(decorated).toContain('mac-code-wrapper');
      expect(decorated).toContain('<span class="mac-code-lang">SWIFT</span>');
      expect(decorated).toContain('let x = 1');
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

  describe('Highlighter Plugin', () => {
    it('highlights TypeScript code with hljs tokens and escapes html tags', () => {
      const code = 'function greet(name: string): string {\n  return `<p>Hello ${name}</p>`;\n}';
      const { highlighted, language } = highlightCode(code, 'typescript');

      expect(language).toBe('typescript');
      expect(highlighted).toContain('class="hljs-keyword">function</span>');
      expect(highlighted).toContain('&lt;p&gt;');
      expect(highlighted).not.toContain('<p>');
    });

    it('highlights Swift code keywords and types', () => {
      const code = 'final class AppState: ObservableObject {\n  @Published var title = "WeChat"\n}';
      const { highlighted, language } = highlightCode(code, 'swift');

      expect(language).toBe('swift');
      expect(highlighted).toContain('hljs-keyword');
      expect(highlighted).toContain('class');
    });

    it('falls back to safe escaped plaintext on unknown language', () => {
      const code = '<div>custom & unusual <syntax></div>';
      const { highlighted, language } = highlightCode(code, 'unknown-xyz');

      expect(language).toBe('unknown-xyz');
      expect(highlighted).toContain('&lt;div&gt;');
      expect(highlighted).not.toContain('<div');
    });

    it('renders line numbers column when showLineNumber is true', () => {
      const code = 'const a = 1;\nconst b = 2;\nconst c = 3;';
      const { highlighted } = highlightCode(code, 'typescript', true);

      expect(highlighted).toContain('code-line-numbers');
      expect(highlighted).toContain('1');
      expect(highlighted).toContain('2');
      expect(highlighted).toContain('3');
      expect(highlighted).toContain('<br/>');
    });
  });

  describe('Task Lists Plugin', () => {
    it('transforms checked and unchecked inputs into WeChat-safe styled spans', () => {
      const html = '<ul><li><input checked="" disabled="" type="checkbox"> Complete task</li><li><input disabled="" type="checkbox"> Pending task</li></ul>';
      const result = processTaskLists(html, true);

      expect(result).toContain('task-checkbox-checked');
      expect(result).toContain('✓');
      expect(result).toContain('task-checkbox-unchecked');
      expect(result).not.toContain('<input');
      expect(result).toContain('task-list-item');
    });
  });

  describe('Image Figure Plugin', () => {
    it('wraps standalone paragraph images with figure and caption', () => {
      const html = '<p><img src="https://example.com/arch.png" alt="Architecture Diagram" title="Architecture Diagram"></p>';
      const result = processImageFigures(html, true);

      expect(result).toContain('wm-image-figure');
      expect(result).toContain('wm-image-caption');
      expect(result).toContain('Architecture Diagram');
    });

    it('does not touch formula or mermaid images that already have special classes', () => {
      const html = '<p><img src="formula.png" alt="formula" class="wm-formula-block"></p>';
      const result = processImageFigures(html, true);

      expect(result).toBe(html);
    });
  });
});

