/**
 * Structural styling for the markup this plugin emits. See the note on
 * codeDecoratorBaseCss about the no-!important rule.
 */
export const tableScrollerBaseCss = `
.table-scroller {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 1.2em 0;
}
`;

export function wrapTablesWithScroller(html: string, enabled: boolean = true): string {
  if (!enabled) {
    return html;
  }

  return html.replace(/<table(\s+[^>]*)?>([\s\S]*?)<\/table>/g, (match) => {
    return `<section class="table-scroller">${match}</section>`;
  });
}
