export function processGfmAlerts(html: string, enabled: boolean = true): string {
  if (!enabled) {
    return html;
  }

  const alertTypes: Record<string, { label: string; icon: string }> = {
    NOTE: { label: 'Note', icon: 'ℹ️' },
    TIP: { label: 'Tip', icon: '💡' },
    IMPORTANT: { label: 'Important', icon: '📌' },
    WARNING: { label: 'Warning', icon: '⚠️' },
    CAUTION: { label: 'Caution', icon: '🛑' },
  };

  // Matches blockquotes containing [!NOTE], [!TIP], etc.
  const blockquoteRegex = /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/gi;

  return html.replace(blockquoteRegex, (match, typeUpper, firstLineText, restContent) => {
    const type = typeUpper.toUpperCase();
    const config = alertTypes[type] || { label: type, icon: '🔔' };
    const alertClass = `gfm-alert gfm-alert-${type.toLowerCase()}`;

    const content = `<p>${firstLineText}</p>${restContent}`.trim();

    return `
<blockquote class="${alertClass}">
  <div class="gfm-alert-title">${config.icon} ${config.label}</div>
  ${content}
</blockquote>
`.trim();
  });
}
