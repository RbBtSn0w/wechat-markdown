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
