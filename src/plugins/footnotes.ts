import { FootnoteItem } from '../types';

/**
 * Structural styling for the markup this plugin emits. See the note on
 * codeDecoratorBaseCss about the no-!important rule.
 *
 * #576b95 is WeChat's own in-article link color, matching what the WeChat
 * editor renders for neutered links.
 */
export const footnotesBaseCss = `
.footnote-ref {
  color: #57606a;
  font-size: 0.8em;
  vertical-align: super;
  text-decoration: none;
  font-weight: 600;
  padding: 0 2px;
}

.footnotes-container {
  margin-top: 2.5em;
  padding-top: 1.2em;
  border-top: 1px dashed #d0d7de;
  font-size: 0.85em;
  color: #666666;
}

.footnotes-title {
  font-size: 1.05em;
  font-weight: 700;
  color: #57606a;
  margin-bottom: 0.8em;
}

.footnote-item {
  margin: 0.4em 0;
  word-break: break-all;
}

.footnote-url {
  color: #576b95;
  text-decoration: underline;
}
`;

export interface ProcessFootnotesResult {
  markdown: string;
  footnotes: FootnoteItem[];
}

export function processMarkdownFootnotes(markdown: string, siteUrl?: string): ProcessFootnotesResult {
  const footnotes: FootnoteItem[] = [];
  const urlMap = new Map<string, number>();

  // Helper to normalize URL
  const isExternalUrl = (url: string): boolean => {
    if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) {
      return false;
    }
    if (siteUrl && url.startsWith(siteUrl)) {
      return false;
    }
    if (url.startsWith('/') && !url.startsWith('//')) {
      return false; // local relative path
    }
    return /^https?:\/\//i.test(url);
  };

  // Match Markdown links: [text](url) - ignore images ![alt](src)
  const linkRegex = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g;

  const transformedMarkdown = markdown.replace(linkRegex, (match, text, url) => {
    if (!isExternalUrl(url)) {
      return match;
    }

    let index = urlMap.get(url);
    if (!index) {
      index = footnotes.length + 1;
      urlMap.set(url, index);
      footnotes.push({
        index,
        title: text.trim(),
        url: url.trim(),
      });
    }

    return `${text}<sup class="footnote-ref">[${index}]</sup>`;
  });

  return {
    markdown: transformedMarkdown,
    footnotes,
  };
}

export function renderFootnotesHtml(footnotes: FootnoteItem[]): string {
  if (footnotes.length === 0) {
    return '';
  }

  const itemsHtml = footnotes
    .map((item) => {
      return `<p class="footnote-item"><strong>[${item.index}]</strong> ${item.title}: <span class="footnote-url">${item.url}</span></p>`;
    })
    .join('\n');

  return `
<section class="footnotes-container">
  <div class="footnotes-title">📚 参考链接</div>
  ${itemsHtml}
</section>
`.trim();
}
