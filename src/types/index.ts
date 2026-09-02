export type DiagnosticSeverity = 'warning' | 'error';

export interface DiagnosticItem {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  line?: number;
  resource?: string;
}

export interface FootnoteItem {
  index: number;
  title: string;
  url: string;
}

export interface RenderStats {
  images: number;
  formulas: number;
  mermaid: number;
  footnotes: number;
}

export type ImageResolver = (src: string, alt?: string) => Promise<string> | string;

/**
 * Renders a LaTeX expression and returns a string the engine substitutes
 * verbatim into the image `src`.
 *
 * The return value is opaque to the engine: a local file path, a data URI, or
 * an already-uploaded CDN URL are all valid. This is what lets a host that
 * owns its own render/hash/cache/upload pipeline keep `renderMath` enabled
 * instead of disabling the capability and re-implementing the orchestration.
 */
export interface FormulaRenderService {
  renderToImage(expression: string, display: boolean): Promise<string> | string;
}

/** Mermaid counterpart of FormulaRenderService; same opaque-string contract. */
export interface MermaidRenderService {
  renderToImage(code: string): Promise<string> | string;
}

export interface RenderServices {
  formulaRenderer?: FormulaRenderService;
  mermaidRenderer?: MermaidRenderService;
}

export interface RenderOptions {
  /**
   * A registered theme name, or a ThemeConfig used directly. Passing the
   * object avoids mutating the process-global registry via registerTheme.
   * Unknown names fall back to the "tech" theme rather than throwing.
   */
  theme?: string | ThemeConfig;
  customCss?: string;
  /** Replaces the built-in formula/Mermaid renderers when provided. */
  services?: RenderServices;
  siteUrl?: string;
  footnoteLinks?: boolean;
  macCodeBlock?: boolean;
  tableScroller?: boolean;
  gfmAlerts?: boolean;
  renderMath?: boolean;
  renderMermaid?: boolean;
  resolveImage?: ImageResolver;
}

export interface RenderResult {
  html: string;
  title: string;
  digest: string;
  metadata: Record<string, any>;
  footnotes: FootnoteItem[];
  images: string[];
  diagnostics: DiagnosticItem[];
  stats: RenderStats;
}

export interface ThemeConfig {
  name: string;
  description?: string;
  css: string;
}
