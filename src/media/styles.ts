/**
 * Structural styling for the <img>/<p> markup the engine emits for rendered
 * formulas and Mermaid diagrams.
 *
 * These selectors are deliberately scoped as `.markdown-body img.wm-xxx`
 * (specificity 0,2,1) rather than a bare `.wm-xxx` (0,1,0). Themes commonly
 * declare `.markdown-body img { ... }` (0,1,1) -- see themes/tech.ts -- which
 * outranks a bare class regardless of concatenation order and would force a
 * block formula onto its own line. The properties a theme's `img` rule
 * declares but these rules do not (e.g. border-radius) still flow through,
 * which is what keeps a themed formula visually consistent with other images.
 *
 * Must never use !important -- themes are layered after this and would lose.
 */
export const formulaBaseCss = `
.markdown-body p.wm-figure {
  text-align: center;
}

.markdown-body img.wm-formula-inline {
  display: inline-block;
  vertical-align: middle;
  margin: 0 2px;
  max-height: 1.4em;
}

.markdown-body img.wm-formula-block {
  display: inline-block;
  max-width: 90%;
  margin: 12px auto;
}
`;

export const mermaidBaseCss = `
.markdown-body p.wm-figure {
  text-align: center;
}

.markdown-body img.wm-mermaid {
  display: block;
  max-width: 100%;
  margin: 12px auto;
}
`;
