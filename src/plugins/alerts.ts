/**
 * Structural styling for the markup this plugin emits. See the note on
 * codeDecoratorBaseCss about the no-!important rule.
 */
export const alertsBaseCss = `
.gfm-alert {
  margin: 1.2em 0;
  padding: 12px 16px;
  border-left: 4px solid #57606a;
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
