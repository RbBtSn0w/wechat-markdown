/**
 * Structural styling for the markup this plugin emits, in neutral colors.
 * Ships with the capability so a theme only has to supply brand overrides.
 * Must never use !important -- themes are layered after this and would lose.
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
`;

export function decorateCodeBlocks(html: string, enabled: boolean = true): string {
  if (!enabled) {
    return html;
  }

  // Regex to match <pre><code( class="language-xxx")?>...</code></pre>
  const preRegex = /<pre><code(?:\s+class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g;

  return html.replace(preRegex, (match, lang, codeContent) => {
    const displayLang = lang ? lang.toUpperCase() : 'CODE';
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
  <pre><code>${codeContent}</code></pre>
</section>
`.trim();
  });
}
