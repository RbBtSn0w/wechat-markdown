/**
 * GFM Task List / Checkbox Transformer for WeChat Official Accounts.
 *
 * Replaces <input type="checkbox"> with bulletproof WeChat inline elements
 * that survive WeChat sanitizer tag stripping.
 */

export const taskListBaseCss = `
.task-list-item {
  list-style-type: none !important;
  margin-left: -14px !important;
}

.task-checkbox-checked {
  display: inline-block;
  width: 15px;
  height: 15px;
  line-height: 15px;
  text-align: center;
  background-color: #07c160;
  color: #ffffff;
  border-radius: 3px;
  font-size: 11px;
  font-weight: bold;
  margin-right: 6px;
  vertical-align: middle;
}

.task-checkbox-unchecked {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 1.5px solid #888888;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: middle;
}
`;

export function processTaskLists(html: string, enabled: boolean = true): string {
  if (!enabled) {
    return html;
  }

  // 1. Replace checked inputs: <input checked="" disabled="" type="checkbox"> or variations
  const checkedRegex = /<input\b[^>]*?(?:checked(?:="[^"]*")?)[^>]*?type="checkbox"[^>]*>/gi;
  const reverseCheckedRegex = /<input\b[^>]*?type="checkbox"[^>]*?(?:checked(?:="[^"]*")?)[^>]*>/gi;

  let processed = html
    .replace(checkedRegex, `<span class="task-checkbox-checked">✓</span>`)
    .replace(reverseCheckedRegex, `<span class="task-checkbox-checked">✓</span>`);

  // 2. Replace remaining unchecked inputs
  const uncheckedRegex = /<input\b[^>]*?type="checkbox"[^>]*>/gi;
  processed = processed.replace(uncheckedRegex, `<span class="task-checkbox-unchecked"></span>`);

  // 3. Mark parent li with task-list-item class to remove default bullet
  processed = processed.replace(
    /<li>(\s*<span class="task-checkbox-(?:checked|unchecked)">)/g,
    `<li class="task-list-item">$1`,
  );

  return processed;
}
