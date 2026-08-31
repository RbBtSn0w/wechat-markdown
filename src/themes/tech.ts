export const techTheme = `
.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 15px;
  line-height: 1.8;
  color: #2b2b2b;
  word-break: break-word;
  padding: 0 4px;
}

.markdown-body p {
  margin: 1.1em 0;
  letter-spacing: 0.5px;
}

.markdown-body h1 {
  font-size: 1.4em;
  font-weight: 700;
  color: #0f4c81;
  margin: 1.8em 0 0.8em;
  padding-bottom: 0.4em;
  border-bottom: 2px solid #0f4c81;
}

.markdown-body h2 {
  font-size: 1.25em;
  font-weight: 700;
  color: #0f4c81;
  margin: 1.5em 0 0.7em;
  padding-left: 10px;
  border-left: 4px solid #0f4c81;
}

.markdown-body h3 {
  font-size: 1.1em;
  font-weight: 700;
  color: #1a5f7a;
  margin: 1.2em 0 0.5em;
}

.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  font-size: 1em;
  font-weight: 700;
  color: #333333;
  margin: 1em 0 0.5em;
}

.markdown-body strong {
  font-weight: 700;
  color: #0f4c81;
}

.markdown-body em {
  font-style: italic;
  color: #555555;
}

.markdown-body blockquote {
  margin: 1.2em 0;
  padding: 12px 16px;
  color: #555555;
  background-color: #f0f6fa;
  border-left: 4px solid #0f4c81;
  border-radius: 4px;
}

.markdown-body blockquote p {
  margin: 0.4em 0;
}

.markdown-body ul, .markdown-body ol {
  margin: 1em 0;
  padding-left: 22px;
}

.markdown-body li {
  margin: 0.4em 0;
  line-height: 1.7;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid #e1e4e8;
  margin: 2em 0;
}

.markdown-body code {
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 0.88em;
  background-color: #f3f6f9;
  color: #c7254e;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e1e8ed;
}

.markdown-body pre {
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 0.85em;
  background-color: #282c34;
  color: #abb2bf;
  padding: 14px 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1.2em 0;
  line-height: 1.6;
}

.markdown-body pre code {
  background-color: transparent;
  color: inherit;
  padding: 0;
  border: none;
  font-size: inherit;
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.2em 0;
  font-size: 0.9em;
}

.markdown-body th {
  background-color: #f0f6fa;
  color: #0f4c81;
  font-weight: 700;
  padding: 8px 12px;
  border: 1px solid #d0d7de;
  text-align: left;
}

.markdown-body td {
  padding: 8px 12px;
  border: 1px solid #d0d7de;
}

.markdown-body tr:nth-child(even) {
  background-color: #f9fbfd;
}

.markdown-body img {
  max-width: 100%;
  border-radius: 6px;
  margin: 1em auto;
  display: block;
}

/* Mac Code Block Container */
.mac-code-wrapper {
  margin: 1.2em 0;
  border-radius: 6px;
  overflow: hidden;
  background-color: #282c34;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.mac-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background-color: #21252b;
  border-bottom: 1px solid #181a1f;
}

.mac-dots {
  display: flex;
  gap: 6px;
}

.mac-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.mac-dot-red { background-color: #ff5f56; }
.mac-dot-yellow { background-color: #ffbd2e; }
.mac-dot-green { background-color: #27c93f; }

.mac-code-lang {
  font-size: 11px;
  color: #7f848e;
  text-transform: uppercase;
  font-family: Menlo, Monaco, Consolas, monospace;
}

/* Table Scroller Wrapper */
.table-scroller {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 1.2em 0;
}

/* Footnotes */
.footnote-ref {
  color: #0f4c81;
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
  color: #0f4c81;
  margin-bottom: 0.8em;
}

.footnote-item {
  margin: 0.4em 0;
  word-break: break-all;
}

/* Alerts */
.gfm-alert {
  margin: 1.2em 0;
  padding: 12px 16px;
  border-left: 4px solid #0f4c81;
  border-radius: 4px;
  background-color: #f6f8fa;
}

.gfm-alert-note { border-left-color: #0969da; background-color: #ddf4ff; }
.gfm-alert-tip { border-left-color: #1a7f37; background-color: #dafbe1; }
.gfm-alert-important { border-left-color: #8250df; background-color: #fbefff; }
.gfm-alert-warning { border-left-color: #9a6700; background-color: #fff8c5; }
.gfm-alert-caution { border-left-color: #cf222e; background-color: #ffebe9; }

.gfm-alert-title {
  font-weight: 700;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
}
`;
