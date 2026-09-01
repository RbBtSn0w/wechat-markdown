import { marked } from 'marked';
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
import { wrapTablesWithScroller, tableScrollerBaseCss } from './plugins/table-scroller';
import { processGfmAlerts, alertsBaseCss } from './plugins/alerts';
import { FormulaRenderer } from './media/formula';
import { MermaidRenderer } from './media/mermaid';
import { formulaBaseCss, mermaidBaseCss } from './media/styles';
import { inlineWechatCss } from './inliner/inliner';

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
  private extractFrontmatter(content: string): { metadata: Record<string, any>; markdown: string } {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
      try {
        const parsed = yaml.parse(match[1]) || {};
        return {
          metadata: parsed,
          markdown: match[2],
        };
      } catch {
        // Return original if parsing fails
        return { metadata: {}, markdown: content };
      }
    }

    return { metadata: {}, markdown: content };
  }

  /**
   * Process and render LaTeX formulas in Markdown to images
   */
  private async processFormulas(
    markdown: string,
    diagnostics: DiagnosticItem[],
    renderer: FormulaRenderService,
  ): Promise<{ markdown: string; count: number }> {
    let count = 0;
    let processed = markdown;

    // 1. Block formulas: $$...$$
    const blockFormulaRegex = /\$\$([\s\S]+?)\$\$/g;
    const blockMatches = [...processed.matchAll(blockFormulaRegex)];

    for (const match of blockMatches) {
      const fullMatch = match[0];
      const expr = match[1].trim();
      try {
        const imagePath = await renderer.renderToImage(expr, true);
        count++;
        processed = processed.replace(
          fullMatch,
          `\n\n<p class="wm-figure"><img src="${imagePath}" alt="formula" class="wm-formula-block" /></p>\n\n`,
        );
      } catch (err: any) {
        diagnostics.push({
          code: 'FORMULA_RENDER_FAILED',
          severity: 'warning',
          message: `Failed to render block formula: ${err.message}`,
        });
      }
    }

    // 2. Inline formulas: $...$ (avoid escaping currency $10)
    const inlineFormulaRegex = /(?<!\$)\$(?!\$)([^\n$]+?)(?<!\$)\$(?!\$)/g;
    const inlineMatches = [...processed.matchAll(inlineFormulaRegex)];

    for (const match of inlineMatches) {
      const fullMatch = match[0];
      const expr = match[1].trim();
      // Skip simple price formats like $10 or $20.50
      if (/^\d+(\.\d+)?$/.test(expr)) {
        continue;
      }
      try {
        const imagePath = await renderer.renderToImage(expr, false);
        count++;
        processed = processed.replace(
          fullMatch,
          `<img src="${imagePath}" alt="formula" class="wm-formula-inline" />`,
        );
      } catch (err: any) {
        diagnostics.push({
          code: 'FORMULA_RENDER_FAILED',
          severity: 'warning',
          message: `Failed to render inline formula: ${err.message}`,
        });
      }
    }

    return { markdown: processed, count };
  }

  /**
   * Process Mermaid code blocks to images with degradation support
   */
  private async processMermaid(
    markdown: string,
    diagnostics: DiagnosticItem[],
    renderer: MermaidRenderService,
  ): Promise<{ markdown: string; count: number }> {
    let count = 0;
    let processed = markdown;
    const mermaidRegex = /```mermaid\r?\n([\s\S]*?)```/g;
    const matches = [...processed.matchAll(mermaidRegex)];

    for (const match of matches) {
      const fullMatch = match[0];
      const code = match[1];
      try {
        const imagePath = await renderer.renderToImage(code);
        count++;
        processed = processed.replace(
          fullMatch,
          `\n\n<p class="wm-figure"><img src="${imagePath}" alt="mermaid-diagram" class="wm-mermaid" /></p>\n\n`,
        );
      } catch (err: any) {
        diagnostics.push({
          code: 'MERMAID_RENDER_FAILED',
          severity: 'warning',
          message: `Failed to render Mermaid diagram, falling back to code block: ${err.message}`,
        });
        // Degrade to standard code block
        processed = processed.replace(fullMatch, `\`\`\`text\n${code}\n\`\`\``);
      }
    }

    return { markdown: processed, count };
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
      renderMath = true,
      renderMermaid = true,
      resolveImage,
      services,
    } = options;

    // Structural CSS for the markup each enabled capability emits. Layered
    // under the theme so a theme that styles nothing still renders correctly,
    // and a theme that styles everything keeps full control.
    const baseCss: string[] = [];

    // 1. Extract Frontmatter
    const { metadata, markdown } = this.extractFrontmatter(markdownInput);
    let workingMarkdown = markdown;

    // 2. Extract and extract Title / Digest
    let title = metadata.title || '';
    if (!title) {
      const titleMatch = workingMarkdown.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    let digest = metadata.description || metadata.digest || '';
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

    // 4. Process LaTeX Math
    let formulaCount = 0;
    if (renderMath) {
      baseCss.push(formulaBaseCss);
      const formulaResult = await this.processFormulas(
        workingMarkdown,
        diagnostics,
        this.getFormulaRenderer(services?.formulaRenderer),
      );
      workingMarkdown = formulaResult.markdown;
      formulaCount = formulaResult.count;
    }

    // 5. Process Mermaid Diagrams
    let mermaidCount = 0;
    if (renderMermaid) {
      baseCss.push(mermaidBaseCss);
      const mermaidResult = await this.processMermaid(
        workingMarkdown,
        diagnostics,
        this.getMermaidRenderer(services?.mermaidRenderer),
      );
      workingMarkdown = mermaidResult.markdown;
      mermaidCount = mermaidResult.count;
    }

    // 6. Parse Markdown to HTML via marked
    let rawHtml = await marked.parse(workingMarkdown, {
      gfm: true,
      breaks: false,
    });

    // 7. Process GFM Alerts
    if (gfmAlerts) {
      baseCss.push(alertsBaseCss);
      rawHtml = processGfmAlerts(rawHtml, true);
    }

    // 8. Decorate Code Blocks (Mac Style)
    if (macCodeBlock) {
      baseCss.push(codeDecoratorBaseCss);
      rawHtml = decorateCodeBlocks(rawHtml, true);
    }

    // 9. Wrap Tables in Scroller
    if (tableScroller) {
      baseCss.push(tableScrollerBaseCss);
      rawHtml = wrapTablesWithScroller(rawHtml, true);
    }

    // 10. Append Footnotes HTML
    if (footnotes.length > 0) {
      rawHtml += '\n' + renderFootnotesHtml(footnotes);
    }

    // 11. Async Image Resolver Hook & Collect Images
    const imgRegex = /<img\s+[^>]*src="([^"]+)"[^>]*>/g;
    let match;
    while ((match = imgRegex.exec(rawHtml)) !== null) {
      images.push(match[1]);
    }

    if (resolveImage) {
      const replacements: [string, string][] = [];
      for (const src of images) {
        try {
          const resolved = await resolveImage(src);
          if (resolved && resolved !== src) {
            replacements.push([src, resolved]);
          }
        } catch (err: any) {
          diagnostics.push({
            code: 'IMAGE_RESOLVE_FAILED',
            severity: 'warning',
            message: `Failed to resolve image ${src}: ${err.message}`,
          });
        }
      }

      for (const [original, target] of replacements) {
        rawHtml = rawHtml.split(original).join(target);
      }
    }

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
