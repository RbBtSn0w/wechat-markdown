export function wrapTablesWithScroller(html: string, enabled: boolean = true): string {
  if (!enabled) {
    return html;
  }

  return html.replace(/<table(\s+[^>]*)?>([\s\S]*?)<\/table>/g, (match) => {
    return `<section class="table-scroller">${match}</section>`;
  });
}
