/**
 * Structural styling for the markup this plugin emits, in neutral colors.
 * Ships with the capability so a theme only has to supply brand overrides.
 * Must never use !important on brand properties, but layout-critical properties
 * like white-space: pre and overflow-x: auto must use !important so they
 * survive WeChat Webview's aggressive global typography resets.
 */
export const codeDecoratorBaseCss = `
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

.mac-code-wrapper pre {
  margin: 0 !important;
  padding: 14px 16px !important;
  background-color: #282c34;
  color: #abb2bf;
  font-family: Consolas, Monaco, Menlo, "Courier New", monospace !important;
  font-size: 13px !important;
  line-height: 1.6 !important;
  overflow-x: auto !important;
  white-space: pre !important;
  word-break: normal !important;
  word-wrap: normal !important;
  display: block !important;
  -webkit-overflow-scrolling: touch !important;
}

.mac-code-wrapper pre code {
  font-family: inherit !important;
  font-size: inherit !important;
  padding: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  display: block !important;
  white-space: pre !important;
  word-break: normal !important;
  word-wrap: normal !important;
}
`;

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  ts: 'TYPESCRIPT',
  typescript: 'TYPESCRIPT',
  js: 'JAVASCRIPT',
  javascript: 'JAVASCRIPT',
  jsx: 'JSX',
  tsx: 'TSX',
  swift: 'SWIFT',
  py: 'PYTHON',
  python: 'PYTHON',
  rb: 'RUBY',
  ruby: 'RUBY',
  sh: 'SHELL',
  bash: 'BASH',
  zsh: 'ZSH',
  shell: 'SHELL',
  console: 'CONSOLE',
  terminal: 'TERMINAL',
  json: 'JSON',
  yml: 'YAML',
  yaml: 'YAML',
  md: 'MARKDOWN',
  markdown: 'MARKDOWN',
  html: 'HTML',
  xml: 'XML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'LESS',
  sql: 'SQL',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++',
  cs: 'C#',
  csharp: 'C#',
  go: 'GO',
  golang: 'GO',
  rs: 'RUST',
  rust: 'RUST',
  java: 'JAVA',
  kt: 'KOTLIN',
  kotlin: 'KOTLIN',
  dart: 'DART',
  diff: 'DIFF',
  docker: 'DOCKERFILE',
  dockerfile: 'DOCKERFILE',
  graphql: 'GRAPHQL',
  gql: 'GRAPHQL',
  text: 'TEXT',
  txt: 'TEXT',
  plaintext: 'TEXT',
};

function formatDisplayLanguage(rawClass?: string): string {
  if (!rawClass) {
    return 'CODE';
  }

  // 1. Extract language identifier from class string like "language-typescript", "language-swift"
  const langMatch = rawClass.match(/language-([a-zA-Z0-9_+#.-]+)/i);
  if (langMatch) {
    const rawLang = langMatch[1].toLowerCase();
    if (LANGUAGE_DISPLAY_NAMES[rawLang]) {
      return LANGUAGE_DISPLAY_NAMES[rawLang];
    }
    return rawLang.toUpperCase();
  }

  // 2. Check for standalone language token
  const token = rawClass.trim().split(/\s+/)[0]?.toLowerCase();
  if (token && LANGUAGE_DISPLAY_NAMES[token]) {
    return LANGUAGE_DISPLAY_NAMES[token];
  }

  return 'CODE';
}

export function decorateCodeBlocks(html: string, enabled: boolean = true): string {
  if (!enabled) {
    return html;
  }

  // Regex to match <pre...><code...>...</code></pre> across multiple formatting variations
  // (with or without language classes, titles, or custom attributes)
  const preRegex =
    /<pre\b[^>]*><code(?:\s+[^>]*class=["']([^"']+)["'][^>]*|[^>]*)>([\s\S]*?)<\/code><\/pre>/gi;

  return html.replace(preRegex, (match, rawClass, codeContent) => {
    const displayLang = formatDisplayLanguage(rawClass);
    const codeClassAttr = rawClass ? ` class="${rawClass}"` : '';
    return `
<section class="mac-code-wrapper">
  <section class="mac-code-header">
    <section class="mac-dots">
      <span class="mac-dot mac-dot-red"></span>
      <span class="mac-dot mac-dot-yellow"></span>
      <span class="mac-dot mac-dot-green"></span>
    </section>
    <span class="mac-code-lang">${displayLang}</span>
  </section>
  <pre><code${codeClassAttr}>${codeContent}</code></pre>
</section>
`.trim();
  });
}
