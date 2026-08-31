import sanitizeHtml from 'sanitize-html';

export function sanitizeWechatHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'del', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr', 'img', 'a', 'span', 'div', 'section', 'sup', 'sub',
    ],
    allowedAttributes: {
      '*': ['style', 'class', 'id', 'colspan', 'rowspan', 'align'],
      a: ['href', 'title', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height', 'data-src'],
    },
    allowedSchemes: ['http', 'https', 'data', 'file'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data', 'file'],
    },
  });
}

export function patchWechatListBullets(html: string): string {
  // Strip newlines and spaces around list items to prevent WeChat editor from inserting empty bullets
  return html
    .replace(/<ul([^>]*)>\s+/g, '<ul$1>')
    .replace(/<ol([^>]*)>\s+/g, '<ol$1>')
    .replace(/<\/li>\s+/g, '</li>')
    .replace(/\s+<\/ul>/g, '</ul>')
    .replace(/\s+<\/ol>/g, '</ol>')
    .replace(/<li>\s+/g, '<li>')
    .replace(/\s+<\/li>/g, '</li>');
}

export function cleanWechatAttributes(html: string): string {
  return html
    .replace(/\s+id="[^"]*"/g, '')
    .replace(/\s+class="[^"]*"/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}
