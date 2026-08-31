import juice from 'juice';
import { sanitizeWechatHtml, patchWechatListBullets, cleanWechatAttributes } from './dom-patcher';
import { getTheme } from '../themes';

export interface InlineOptions {
  theme?: string;
  customCss?: string;
  siteUrl?: string;
}

export function inlineWechatCss(html: string, options: InlineOptions = {}): string {
  // 1. Sanitize
  let processedHtml = sanitizeWechatHtml(html);

  // 2. Resolve relative URLs if siteUrl is specified
  if (options.siteUrl) {
    const base = options.siteUrl.replace(/\/$/, '');
    processedHtml = processedHtml.replace(/(<a\s+[^>]*href=")(\/[^"]*)(")/g, (match, p1, p2, p3) => {
      return `${p1}${base}${p2}${p3}`;
    });
  }

  // 3. Wrap in container for CSS matching
  const wrappedHtml = `<div class="markdown-body">${processedHtml}</div>`;

  // 4. Resolve Theme CSS
  const themeCss = getTheme(options.theme, options.customCss);

  // 5. Juice CSS Inlining
  const inlined = juice.inlineContent(wrappedHtml, themeCss, {
    inlinePseudoElements: true,
    preserveImportant: true,
  });

  // 6. Patch WeChat DOM quirks & clean attributes
  let finalHtml = cleanWechatAttributes(inlined);
  finalHtml = patchWechatListBullets(finalHtml);

  return finalHtml;
}
