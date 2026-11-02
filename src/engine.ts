import { Marked, Renderer, Token, Tokenizer, Tokens } from 'marked';
import { load } from 'cheerio';
import { Parser as HtmlParser } from 'htmlparser2';
import { errorMessage } from './errors';
import { validateSiteUrl } from './urls';
import yaml from 'yaml';
import {
  RenderOptions,
  RenderResult,
  DiagnosticItem,
  FootnoteItem,
  FormulaRenderService,
  MermaidRenderService,
} from './types';
import {
  processMarkdownFootnotes,
  renderFootnotesHtml,
  footnotesBaseCss,
} from './plugins/footnotes';
import { decorateCodeBlocks, codeDecoratorBaseCss } from './plugins/code-decorator';
import { highlightCode, getHighlightCss } from './plugins/highlighter';
import { wrapTablesWithScroller, tableScrollerBaseCss } from './plugins/table-scroller';
import { processGfmAlerts, alertsBaseCss } from './plugins/alerts';
import { processTaskLists, taskListBaseCss } from './plugins/task-list';
import { processImageFigures, imageFigureBaseCss } from './plugins/image-figure';
import { FormulaRenderer } from './media/formula';
import { MermaidRenderer } from './media/mermaid';
import { formulaBaseCss, mermaidBaseCss } from './media/styles';
import { inlineWechatCss } from './inliner/inliner';

/**
 * Escapes HTML attribute metacharacters. Render services are host-injectable
 * (FormulaRenderService/MermaidRenderService), so their output is untrusted
 * before it's embedded into an `src="..."` attribute.
 */
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Locate delimiters without treating an escaped dollar as the end of TeX. */
function mathMatch(src: string, display: boolean): { raw: string; expression: string } | undefined {
  const delimiter = display ? '$$' : '$';
  if (!src.startsWith(delimiter) || (!display && src.startsWith('$$'))) return;
  let backslashes = 0;
  for (let index = delimiter.length; index < src.length; index++) {
    const char = src[index];
    if (!display && char === '\n') return;
    const escaped = backslashes % 2 === 1;
    backslashes = char === '\\' ? backslashes + 1 : 0;
    if (escaped || !src.startsWith(delimiter, index)) continue;
    if (!display && (src[index - 1] === '$' || src[index + 1] === '$')) continue;
    const end = index + delimiter.length;
    if (display && !/^(?:[ \t]*\n|$)/.test(src.slice(end))) continue;
    const expression = src.slice(delimiter.length, index).trim();
    if (!expression || (!display && /^\d+(\.\d+)?$/.test(expression))) return;
    return { raw: src.slice(0, end), expression };
  }
}

export class WechatMarkdownEngine {
  private formulaRenderer?: FormulaRenderService;
  private mermaidRenderer?: MermaidRenderService;

  /**
   * Built-in renderers are constructed lazily: they create temp directories on
   * construction, which is wasted work when the host injects its own services
   * or disables the capability outright.
   */
  private getFormulaRenderer(injected?: FormulaRenderService): FormulaRenderService {
    if (injected) {
      return injected;
    }
    return (this.formulaRenderer ??= new FormulaRenderer());
  }

  private getMermaidRenderer(injected?: MermaidRenderService): MermaidRenderService {
    if (injected) {
      return injected;
    }
    return (this.mermaidRenderer ??= new MermaidRenderer());
  }

  /**
   * Parse Front-matter and extract YAML metadata if present
   */
  private extractFrontmatter(
    content: string,
    diagnostics: DiagnosticItem[],
  ): { metadata: Record<string, unknown>; markdown: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { metadata: {}, markdown: content };
    try {
      const parsed: unknown = yaml.parse(match[1]);
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(parsed))
      ) {
        diagnostics.push({
          code: 'FRONTMATTER_INVALID',
          severity: 'warning',
          message: 'Frontmatter must be a plain mapping.',
        });
        return { metadata: {}, markdown: match[2] };
      }
      return { metadata: parsed as Record<string, unknown>, markdown: match[2] };
    } catch (error: unknown) {
      diagnostics.push({
        code: 'FRONTMATTER_INVALID',
        severity: 'warning',
        message: `Failed to parse frontmatter: ${errorMessage(error)}`,
      });
      return { metadata: {}, markdown: content };
    }
  }

  /**
   * Main render method: converts Markdown string into WeChat-ready HTML
   */
  async render(markdownInput: string, options: RenderOptions = {}): Promise<RenderResult> {
    const diagnostics: DiagnosticItem[] = [];
    const images: string[] = [];

    const {
      theme = 'tech',
      customCss,
      siteUrl,
      footnoteLinks = true,
      macCodeBlock = true,
      tableScroller = true,
      gfmAlerts = true,
      taskLists = true,
      imageFigures = true,
      highlightTheme = 'atom-one-dark',
      showLineNumber = false,
      renderMath = true,
      renderMermaid = true,
      resolveImage,
      services,
    } = options;

    validateSiteUrl(siteUrl);

    // Structural CSS for the markup each enabled capability emits. Layered
    // under the theme so a theme that styles nothing still renders correctly,
    // and a theme that styles everything keeps full control.
    const baseCss: string[] = [];

    // 1. Extract Frontmatter
    const { metadata, markdown } = this.extractFrontmatter(markdownInput, diagnostics);
    let workingMarkdown = markdown;

    // 2. Extract and extract Title / Digest
    const fields: Record<string, string> = {};
    for (const key of ['title', 'description', 'digest']) {
      if (!(key in metadata)) continue;
      const value = metadata[key];
      if (typeof value === 'string' && value.trim()) fields[key] = value;
      else
        diagnostics.push({
          code: 'FRONTMATTER_INVALID',
          severity: 'warning',
          message: `Frontmatter ${key} must be a nonempty string.`,
        });
    }
    let title = fields.title || '';
    if (!title) {
      const titleMatch = workingMarkdown.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    let digest = fields.description || fields.digest || '';
    if (!digest) {
      // Find first non-empty paragraph
      const cleanPara = workingMarkdown
        .replace(/^#+.*$/gm, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '$1')
        .trim();
      const firstPara = cleanPara.split('\n\n')[0] || '';
      digest = firstPara.replace(/\s+/g, ' ').slice(0, 120);
    }

    // 3. Process Footnotes & External Links
    let footnotes: FootnoteItem[] = [];
    if (footnoteLinks) {
      baseCss.push(footnotesBaseCss);
      const footnoteResult = processMarkdownFootnotes(workingMarkdown, siteUrl);
      workingMarkdown = footnoteResult.markdown;
      footnotes = footnoteResult.footnotes;
    }

    let formulaCount = 0;
    let mermaidCount = 0;
    if (renderMath) baseCss.push(formulaBaseCss);
    if (renderMermaid) baseCss.push(mermaidBaseCss);

    // Base code highlighting CSS
    baseCss.push(getHighlightCss(highlightTheme));

    // 6. Parse Markdown to HTML via marked with syntax highlighting
    const markedRenderer = new Renderer();
    markedRenderer.code = (code: string, infostring?: string) => {
      const lang = (infostring || '').match(/^\S*/)?.[0] || '';
      const { highlighted, language } = highlightCode(code, lang, showLineNumber);
      const safeLang = escapeHtmlAttribute(language.replace(/[^\w#+.-]/g, ''));
      const langClass =
        safeLang && safeLang !== 'plaintext'
          ? ` class="language-${safeLang} hljs"`
          : ' class="hljs"';
      return `<pre><code${langClass}>${highlighted}</code></pre>\n`;
    };

    const parser = new Marked({ gfm: true, breaks: false, renderer: markedRenderer });
    type MediaToken = Tokens.Generic & {
      expression?: string;
      display?: boolean;
      html?: string;
      inHtml?: boolean;
    };
    let inlineMath = false;
    let htmlDepth = 0;
    if (renderMath) {
      parser.use({
        extensions: [
          {
            name: 'mathBlock',
            level: 'block',
            start(src) {
              return /^ {0,3}\$\$/m.exec(src)?.index;
            },
            tokenizer(src) {
              const indentation = /^ {0,3}(?=\$\$)/.exec(src)?.[0] ?? '';
              const match = mathMatch(src.slice(indentation.length), true);
              if (match)
                return {
                  type: 'mathBlock',
                  raw: indentation + match.raw,
                  expression: match.expression,
                  display: true,
                };
            },
            renderer(token) {
              return (token as MediaToken).html ?? escapeHtmlAttribute(token.raw);
            },
          },
          {
            name: 'mathInline',
            level: 'inline',
            start(src) {
              if (inlineMath && !htmlDepth) return src.indexOf('$');
            },
            tokenizer(src) {
              if (!inlineMath || htmlDepth) return;
              const match = mathMatch(src, false);
              if (match) {
                return {
                  type: 'mathInline',
                  raw: match.raw,
                  expression: match.expression,
                  display: false,
                };
              }
            },
            renderer(token) {
              return (token as MediaToken).html ?? escapeHtmlAttribute(token.raw);
            },
          },
        ],
      });
    }
    const tokens = parser.lexer(workingMarkdown);
    if (renderMath) {
      const htmlScope = new HtmlParser({
        onopentag() {
          htmlDepth++;
        },
        onclosetag() {
          htmlDepth--;
        },
      });
      parser.use({
        tokenizer: {
          tag(this: Tokenizer, src) {
            const token = Tokenizer.prototype.tag.call(this, src);
            if (token) htmlScope.write(token.raw);
            return token;
          },
        },
      });
      const inlineLexer = new parser.Lexer(parser.defaults);
      inlineLexer.tokens.links = tokens.links;
      inlineMath = true;
      // Marked defers inline lexing until every block has been read. Re-lex inline
      // content in document order so block and inline HTML share the same scope.
      const tokenizeInlineContent = (blocks: Token[]): void => {
        for (const token of blocks) {
          switch (token.type) {
            case 'html':
              htmlScope.write(token.raw);
              break;
            case 'paragraph':
            case 'heading':
            case 'text':
              Object.assign(token, { tokens: inlineLexer.inlineTokens(token.text) });
              break;
            case 'blockquote':
              tokenizeInlineContent(token.tokens ?? []);
              break;
            case 'list':
              for (const item of token.items) tokenizeInlineContent(item.tokens);
              break;
            case 'table':
              for (const cell of [...token.header, ...token.rows.flat()]) {
                cell.tokens = inlineLexer.inlineTokens(cell.text);
              }
              break;
            case 'mathBlock':
              (token as MediaToken).inHtml = htmlDepth > 0;
              break;
          }
        }
      };
      tokenizeInlineContent(tokens);
      htmlScope.end();
    }
    const mediaTokens: Token[] = [];
    parser.walkTokens(tokens, (token) => {
      mediaTokens.push(token);
    });
    for (const token of mediaTokens) {
      if (token.type === 'mathBlock' || token.type === 'mathInline') {
        const media = token as MediaToken;
        if (media.inHtml) continue;
        try {
          const image = await this.getFormulaRenderer(services?.formulaRenderer).renderToImage(
            media.expression!,
            media.display!,
          );
          formulaCount++;
          const img = `<img src="${escapeHtmlAttribute(image)}" alt="formula" class="wm-formula-${media.display ? 'block' : 'inline'}" />`;
          media.html = media.display ? `<p class="wm-figure">${img}</p>\n` : img;
        } catch (error: unknown) {
          diagnostics.push({
            code: 'FORMULA_RENDER_FAILED',
            severity: 'warning',
            message: `Failed to render ${media.display ? 'block' : 'inline'} formula: ${errorMessage(error)}`,
          });
        }
      } else if (
        renderMermaid &&
        token.type === 'code' &&
        token.lang?.split(/\s+/)[0] === 'mermaid'
      ) {
        try {
          const image = await this.getMermaidRenderer(services?.mermaidRenderer).renderToImage(
            token.text,
          );
          mermaidCount++;
          Object.assign(token, {
            type: 'html',
            text: `<p class="wm-figure"><img src="${escapeHtmlAttribute(image)}" alt="mermaid-diagram" class="wm-mermaid" /></p>\n`,
          });
        } catch (error: unknown) {
          diagnostics.push({
            code: 'MERMAID_RENDER_FAILED',
            severity: 'warning',
            message: `Failed to render Mermaid diagram, falling back to code block: ${errorMessage(error)}`,
          });
          token.lang = 'text';
        }
      }
    }
    let rawHtml = parser.parser(tokens);

    // 7. Process GFM Alerts
    if (gfmAlerts) {
      baseCss.push(alertsBaseCss);
      rawHtml = processGfmAlerts(rawHtml, true);
    }

    // 8. Process GFM Task Lists / Checkboxes
    if (taskLists) {
      baseCss.push(taskListBaseCss);
      rawHtml = processTaskLists(rawHtml, true);
    }

    // 9. Decorate Code Blocks (Mac Style)
    if (macCodeBlock) {
      baseCss.push(codeDecoratorBaseCss);
      rawHtml = decorateCodeBlocks(rawHtml, true);
    }

    // 10. Wrap Tables in Scroller
    if (tableScroller) {
      baseCss.push(tableScrollerBaseCss);
      rawHtml = wrapTablesWithScroller(rawHtml, true);
    }

    // 11. Wrap Images in Figures with Captions
    if (imageFigures) {
      baseCss.push(imageFigureBaseCss);
      rawHtml = processImageFigures(rawHtml, true);
    }

    // 12. Append Footnotes HTML
    if (footnotes.length > 0) {
      rawHtml += '\n' + renderFootnotesHtml(footnotes);
    }

    // Resolve actual image nodes individually; identical sources may have distinct captions.
    const fragment = load(rawHtml, {}, false);
    for (const node of fragment('img').toArray()) {
      const image = fragment(node);
      const src = image.attr('src');
      if (src === undefined) continue;
      images.push(src);
      if (!resolveImage) continue;
      try {
        const resolved = await resolveImage(src, image.attr('alt'));
        if (resolved) image.attr('src', resolved);
      } catch (error: unknown) {
        diagnostics.push({
          code: 'IMAGE_RESOLVE_FAILED',
          severity: 'warning',
          message: `Failed to resolve image ${src}: ${errorMessage(error)}`,
        });
      }
    }
    rawHtml = fragment.html();

    // 12. Inline CSS & WeChat DOM Patching
    const finalHtml = inlineWechatCss(rawHtml, {
      theme,
      customCss,
      siteUrl,
      baseCss,
    });

    return {
      html: finalHtml,
      title,
      digest,
      metadata,
      footnotes,
      images,
      diagnostics,
      stats: {
        images: images.length,
        formulas: formulaCount,
        mermaid: mermaidCount,
        footnotes: footnotes.length,
      },
    };
  }
}

/**
 * Functional entrypoint to render Markdown to WeChat-ready HTML
 */
export async function renderMarkdownToWechat(
  markdown: string,
  options?: RenderOptions,
): Promise<RenderResult> {
  const engine = new WechatMarkdownEngine();
  return engine.render(markdown, options);
}
