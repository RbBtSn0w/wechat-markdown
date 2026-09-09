/**
 * Syntax Highlighting Plugin for WeChat Official Account Markdown Rendering.
 *
 * Inspired by and adapted from the open-source industry standard doocs/md:
 * https://github.com/doocs/md (MIT License)
 *
 * Uses highlight.js for AST-level lexical highlighting, generating class-tagged
 * spans that are subsequently inlined by Juice into safe, bulletproof WeChat inline styles.
 */

import hljs from "highlight.js";

export type HighlightThemeName = "atom-one-dark" | "github-light" | "monokai";

export const atomOneDarkCss = `
.markdown-body pre code.hljs, .mac-code-wrapper pre code.hljs, code.hljs, .hljs { color: #abb2bf; background: #282c34; background-color: #282c34; }
.hljs-comment, .hljs-quote { color: #5c6370; font-style: italic; }
.hljs-doctag, .hljs-keyword, .hljs-formula { color: #c678dd; font-weight: bold; }
.hljs-section, .hljs-name, .hljs-selector-tag, .hljs-deletion, .hljs-subst { color: #e06c75; }
.hljs-literal { color: #56b6c2; }
.hljs-string, .hljs-regexp, .hljs-addition, .hljs-attribute, .hljs-meta .hljs-string { color: #98c379; }
.hljs-built_in, .hljs-title.class_, .hljs-class .hljs-title { color: #e5c07b; }
.hljs-attr, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-number { color: #d19a66; }
.hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta, .hljs-selector-id, .hljs-title, .hljs-title.function_ { color: #61aeee; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
`;

export const githubLightCss = `
.markdown-body pre code.hljs, .mac-code-wrapper pre code.hljs, code.hljs, .hljs { color: #24292e; background: #f6f8fa; background-color: #f6f8fa; }
.hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
.hljs-doctag, .hljs-keyword, .hljs-formula { color: #d73a49; font-weight: bold; }
.hljs-section, .hljs-name, .hljs-selector-tag, .hljs-deletion, .hljs-subst { color: #d73a49; }
.hljs-literal { color: #005cc5; }
.hljs-string, .hljs-regexp, .hljs-addition, .hljs-attribute, .hljs-meta .hljs-string { color: #032f62; }
.hljs-built_in, .hljs-title.class_, .hljs-class .hljs-title { color: #6f42c1; }
.hljs-attr, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-number { color: #e36209; }
.hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta, .hljs-selector-id, .hljs-title, .hljs-title.function_ { color: #005cc5; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
`;

export const monokaiCss = `
.markdown-body pre code.hljs, .mac-code-wrapper pre code.hljs, code.hljs, .hljs { color: #f8f8f2; background: #272822; background-color: #272822; }
.hljs-comment, .hljs-quote { color: #75715e; font-style: italic; }
.hljs-doctag, .hljs-keyword, .hljs-formula { color: #f92672; font-weight: bold; }
.hljs-section, .hljs-name, .hljs-selector-tag, .hljs-deletion, .hljs-subst { color: #f92672; }
.hljs-literal { color: #ae81ff; }
.hljs-string, .hljs-regexp, .hljs-addition, .hljs-attribute, .hljs-meta .hljs-string { color: #e6db74; }
.hljs-built_in, .hljs-title.class_, .hljs-class .hljs-title { color: #a6e22e; }
.hljs-attr, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-number { color: #fd971f; }
.hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta, .hljs-selector-id, .hljs-title, .hljs-title.function_ { color: #66d9ef; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
`;

export const highlightBaseCss = atomOneDarkCss;

export function getHighlightCss(themeName?: HighlightThemeName | string): string {
  switch (themeName) {
    case "github-light":
      return githubLightCss;
    case "monokai":
      return monokaiCss;
    case "atom-one-dark":
    default:
      return atomOneDarkCss;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\x27/g, "&#39;");
}

/**
 * Split highlighted HTML into lines while preserving open <span> context.
 * Adapts doocs/md approach to ensure proper tag closures on every line.
 */
export function splitHighlightedHtmlByLines(html: string): string[] {
  const lines: string[] = [];
  let currentLine = '';
  const openTags: string[] = [];

  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      let tag = '<';
      i++;
      while (i < html.length && html[i] !== '>') {
        tag += html[i];
        i++;
      }
      if (i < html.length) {
        tag += '>';
        i++;
      }

      currentLine += tag;

      if (tag.startsWith('</span')) {
        openTags.pop();
      } else if (tag.startsWith('<span')) {
        openTags.push(tag);
      }
    } else if (html[i] === '\n') {
      const closingTags = '</span>'.repeat(openTags.length);
      lines.push(currentLine + closingTags);
      currentLine = openTags.join('');
      i++;
    } else {
      currentLine += html[i];
      i++;
    }
  }

  lines.push(currentLine);
  return lines;
}

/**
 * Replaces tab indentation and leading/consecutive whitespace with &nbsp;,
 * ensuring indentation survives WeChat rich text sanitization while preserving
 * standard single spaces between words for searchability.
 */
export function formatCodeLine(lineHtml: string): string {
  let formatted = lineHtml.replace(/\t/g, '    ');
  // Transform only the text content outside tags:
  formatted = formatted.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) return tag;
    return text.replace(/ {2,}/g, (m: string) => '&nbsp;'.repeat(m.length));
  });
  // Match leading spaces, even if preceded by open tags like <span ...>
  formatted = formatted.replace(/^((?:<[^>]+>)*)( +)/, (_, tags, spaces) => tags + '&nbsp;'.repeat(spaces.length));
  return formatted === '' ? '&nbsp;' : formatted;
}

/**
 * Formats highlighted HTML into WeChat-bulletproof markup with explicit line breaks (<br/>)
 * and non-breaking indentation spaces (&nbsp;) wrapped in a single block element,
 * with optional line numbers column.
 */
export function formatHighlightedCode(rawHtml: string, showLineNumber: boolean = false): string {
  const lines = splitHighlightedHtmlByLines(rawHtml).map(formatCodeLine);
  if (showLineNumber && lines.length > 0) {
    const lineNumbersHtml = lines
      .map((_, idx) => `<span style="display: block; line-height: 1.6; padding: 0 8px 0 0; text-align: right;">${idx + 1}</span>`)
      .join('');
    const codeContentHtml = lines.join('<br/>');
    return `
<span style="display: flex; align-items: flex-start; width: 100%; box-sizing: border-box;">
  <span class="code-line-numbers" style="display: block; padding: 0 10px 0 0; border-right: 1px solid rgba(255, 255, 255, 0.1); user-select: none; color: #5c6370; font-size: inherit; font-family: inherit;">${lineNumbersHtml}</span>
  <span class="code-scroll" style="display: block; flex: 1 1 auto; overflow-x: auto; padding-left: 12px; min-width: 0;">
    <span class="code-block__inner" style="display: block;">${codeContentHtml}</span>
  </span>
</span>`.trim();
  }
  return `<span class="code-block__inner" style="display: block;">${lines.join('<br/>')}</span>`;
}

/**
 * Highlights code using highlight.js with safe fallback to escaped plain text.
 */
export function highlightCode(
  code: string,
  rawLang?: string,
  showLineNumber: boolean = false
): { highlighted: string; language: string } {
  const cleanLang = (rawLang || '').trim().toLowerCase().match(/^[a-zA-Z0-9_#+.-]+/)?.[0] || '';
  const normalizedCode = code.replace(/\r\n?/g, '\n');

  // Try explicit language match
  if (cleanLang && hljs.getLanguage(cleanLang)) {
    try {
      const result = hljs.highlight(normalizedCode, { language: cleanLang, ignoreIllegals: true });
      return { highlighted: formatHighlightedCode(result.value, showLineNumber), language: cleanLang };
    } catch {
      // Fallback
    }
  }

  // Automatic language detection if code is reasonably sized
  if (!cleanLang && normalizedCode.length > 10) {
    try {
      const auto = hljs.highlightAuto(normalizedCode);
      if (auto.language && auto.relevance > 3) {
        return { highlighted: formatHighlightedCode(auto.value, showLineNumber), language: auto.language };
      }
    } catch {
      // Fallback
    }
  }

  return {
    highlighted: formatHighlightedCode(escapeHtml(normalizedCode), showLineNumber),
    language: cleanLang || 'plaintext',
  };
}
