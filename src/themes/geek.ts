export const geekTheme = `
.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
  font-size: 15px;
  line-height: 1.78;
  color: #24292f;
  word-break: break-word;
  padding: 0 4px;
}

.markdown-body p {
  margin: 1.1em 0;
}

.markdown-body h1 {
  font-size: 1.4em;
  font-weight: 800;
  color: #1f2328;
  margin: 1.8em 0 0.8em;
  padding-bottom: 0.3em;
  border-bottom: 2px solid #fd7e14;
}

.markdown-body h2 {
  font-size: 1.25em;
  font-weight: 800;
  color: #1f2328;
  margin: 1.5em 0 0.7em;
  padding-left: 10px;
  border-left: 4px solid #fd7e14;
}

.markdown-body h3 {
  font-size: 1.1em;
  font-weight: 700;
  color: #d9480f;
  margin: 1.2em 0 0.5em;
}

.markdown-body strong {
  font-weight: 700;
  color: #d9480f;
}

.markdown-body blockquote {
  margin: 1.2em 0;
  padding: 12px 16px;
  color: #495057;
  background-color: #fff9db;
  border-left: 4px solid #fd7e14;
  border-radius: 4px;
}

.markdown-body code {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 0.88em;
  background-color: #f1f3f5;
  color: #d6336c;
  padding: 2px 6px;
  border-radius: 4px;
}

.markdown-body pre {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  background-color: #181a1b;
  color: #f8f9fa;
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
  background-color: #f8f9fa;
  color: #212529;
  font-weight: 700;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
}

.markdown-body td {
  padding: 8px 12px;
  border: 1px solid #dee2e6;
}

.table-scroller {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 1.2em 0;
}

.footnote-ref {
  color: #d9480f;
  font-size: 0.8em;
  vertical-align: super;
  font-weight: 600;
}

.footnotes-container {
  margin-top: 2.5em;
  padding-top: 1.2em;
  border-top: 1px dashed #ced4da;
  font-size: 0.85em;
  color: #6c757d;
}

.footnotes-title {
  font-size: 1.05em;
  font-weight: 700;
  color: #d9480f;
  margin-bottom: 0.8em;
}

/* Alerts -- must match the .markdown-body blockquote.gfm-alert* shape of
   alertsBaseCss (specificity 0,2,1). A bare .gfm-alert-note (0,1,0) would
   lose to the base layer and to .markdown-body blockquote above.
   Saturated hues to match the theme's high-contrast palette; WARNING sits on
   orange rather than the house yellow so it cannot be mistaken for a plain
   blockquote. The .gfm-alert fallback deliberately mirrors the plain
   blockquote: it is unreachable while all five types match, and an unknown
   future type should degrade to the theme's own quote look. */
.markdown-body blockquote.gfm-alert {
  margin: 1.2em 0;
  padding: 12px 16px;
  border-left: 4px solid #fd7e14;
  border-radius: 4px;
  background-color: #fff9db;
}

.markdown-body blockquote.gfm-alert-note { border-left-color: #1c7ed6; background-color: #e7f5ff; }
.markdown-body blockquote.gfm-alert-tip { border-left-color: #2f9e44; background-color: #ebfbee; }
.markdown-body blockquote.gfm-alert-important { border-left-color: #7048e8; background-color: #f3f0ff; }
.markdown-body blockquote.gfm-alert-warning { border-left-color: #f76707; background-color: #fff4e6; }
.markdown-body blockquote.gfm-alert-caution { border-left-color: #e03131; background-color: #fff5f5; }
`;
