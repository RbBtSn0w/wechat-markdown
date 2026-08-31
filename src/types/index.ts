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

export interface RenderOptions {
  theme?: string;
  customCss?: string;
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
