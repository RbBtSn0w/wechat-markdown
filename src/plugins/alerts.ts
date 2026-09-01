/**
 * Structural styling for the markup this plugin emits. See the note on
 * codeDecoratorBaseCss about the no-!important rule.
 *
 * The alert selectors are deliberately scoped as
 * `.markdown-body blockquote.gfm-alert-note` (specificity 0,2,1) rather than a
 * bare `.gfm-alert-note` (0,1,0). Every theme declares
 * `.markdown-body blockquote { background-color: ...; border-left: ... }`
 * (0,1,1) -- see themes/tech.ts -- which outranks a bare class regardless of
 * concatenation order and collapsed all five alert types onto one generic
 * blockquote look. Same defect class as the `img.wm-formula-*` rules; the
 * rationale block in media/styles.ts covers it in full.
 *
 * Consequence for themes: a theme that wants to restyle alerts must match this
 * shape (`.markdown-body blockquote.gfm-alert-note`), because a bare
 * `.gfm-alert-note` would now lose to this base layer and invert the intended
 * base-under-theme layering.
 *
 * `.gfm-alert-title` stays unscoped in both layers on purpose: no theme
 * declares an element-scoped rule that competes with it, so a bare class still
 * lets themes override it by concatenation order.
 *
 * Must never use !important -- themes are layered after this and would lose.
 */
export const alertsBaseCss = `
.markdown-body blockquote.gfm-alert {
  margin: 1.2em 0;
  padding: 12px 16px;
  border-left: 4px solid #57606a;
  border-radius: 4px;
  background-color: #f6f8fa;
}

.markdown-body blockquote.gfm-alert-note { border-left-color: #0969da; background-color: #ddf4ff; }
.markdown-body blockquote.gfm-alert-tip { border-left-color: #1a7f37; background-color: #dafbe1; }
.markdown-body blockquote.gfm-alert-important { border-left-color: #8250df; background-color: #fbefff; }
.markdown-body blockquote.gfm-alert-warning { border-left-color: #9a6700; background-color: #fff8c5; }
.markdown-body blockquote.gfm-alert-caution { border-left-color: #cf222e; background-color: #ffebe9; }

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
