export const graceTheme = `
.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 15px;
  line-height: 1.85;
  color: #3f4448;
  word-break: break-word;
  padding: 0 4px;
}

.markdown-body p {
  margin: 1.15em 0;
  letter-spacing: 0.6px;
}

.markdown-body h1 {
  font-size: 1.35em;
  font-weight: 700;
  color: #2d6a4f;
  margin: 1.8em 0 0.8em;
  padding-bottom: 0.4em;
  border-bottom: 2px solid #52b788;
}

.markdown-body h2 {
  font-size: 1.2em;
  font-weight: 700;
  color: #2d6a4f;
  margin: 1.5em 0 0.7em;
  padding-left: 10px;
  border-left: 4px solid #52b788;
}

.markdown-body h3 {
  font-size: 1.08em;
  font-weight: 700;
  color: #40916c;
  margin: 1.2em 0 0.5em;
}

.markdown-body strong {
  font-weight: 700;
  color: #2d6a4f;
}

.markdown-body blockquote {
  margin: 1.2em 0;
  padding: 12px 16px;
  color: #52796f;
  background-color: #f1f8f5;
  border-left: 4px solid #52b788;
  border-radius: 4px;
}

.markdown-body code {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 0.88em;
  background-color: #edf6f2;
  color: #2d6a4f;
  padding: 2px 6px;
  border-radius: 4px;
}

.markdown-body pre {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  background-color: #1b262c;
  color: #bbe1fa;
  padding: 14px 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1.2em 0;
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.2em 0;
  font-size: 0.9em;
}

.markdown-body th {
  background-color: #e8f5e9;
  color: #2d6a4f;
  font-weight: 700;
  padding: 8px 12px;
  border: 1px solid #c8e6c9;
}

.markdown-body td {
  padding: 8px 12px;
  border: 1px solid #c8e6c9;
}

.table-scroller {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 1.2em 0;
}

.footnote-ref {
  color: #2d6a4f;
  font-size: 0.8em;
  vertical-align: super;
  font-weight: 600;
}

.footnotes-container {
  margin-top: 2.5em;
  padding-top: 1.2em;
  border-top: 1px dashed #b7e4c7;
  font-size: 0.85em;
  color: #666666;
}

.footnotes-title {
  font-size: 1.05em;
  font-weight: 700;
  color: #2d6a4f;
  margin-bottom: 0.8em;
}

/* Alerts -- must match the .markdown-body blockquote.gfm-alert* shape of
   alertsBaseCss (specificity 0,2,1). A bare .gfm-alert-note (0,1,0) would
   lose to the base layer and to .markdown-body blockquote above.
   Muted Morandi hues so the five types stay distinguishable without breaking
   the theme's low-saturation palette. The .gfm-alert fallback deliberately
   mirrors the plain blockquote: it is unreachable while all five types match,
   and an unknown future type should degrade to the theme's own quote look. */
.markdown-body blockquote.gfm-alert {
  margin: 1.2em 0;
  padding: 12px 16px;
  color: #3f4448;
  border-left: 4px solid #52b788;
  border-radius: 4px;
  background-color: #f1f8f5;
}

.markdown-body blockquote.gfm-alert-note { border-left-color: #5c8ca8; background-color: #eef4f8; }
.markdown-body blockquote.gfm-alert-tip { border-left-color: #40916c; background-color: #e6f4ec; }
.markdown-body blockquote.gfm-alert-important { border-left-color: #8a7ba8; background-color: #f2f0f7; }
.markdown-body blockquote.gfm-alert-warning { border-left-color: #b48a5a; background-color: #f8f3ea; }
.markdown-body blockquote.gfm-alert-caution { border-left-color: #b06a70; background-color: #f9eff0; }
`;
