import juice from 'juice';
import { load } from 'cheerio';
import { validateSiteUrl } from '../urls';
import { sanitizeWechatHtml, patchWechatListBullets, cleanWechatAttributes } from './dom-patcher';
import { getTheme } from '../themes';
import { ThemeConfig } from '../types';

export interface InlineOptions {
  theme?: string | ThemeConfig;
  customCss?: string;
  siteUrl?: string;
  /**
   * Structural CSS contributed by the enabled capabilities. Concatenated
   * ahead of the theme so the theme wins on any property it redeclares while
   * base-only properties survive. Base CSS must not use !important.
   */
  baseCss?: string[];
}

export function inlineWechatCss(html: string, options: InlineOptions = {}): string {
  const base = validateSiteUrl(options.siteUrl);
  let resolvedHtml = html;
  if (base) {
    const fragment = load(html, {}, false);
    fragment('a[href]').each((_, node) => {
      const anchor = fragment(node);
      const href = anchor.attr('href')!;
      if (href.startsWith('/') && !href.startsWith('//')) {
        try {
          anchor.attr('href', new URL(href, base).href);
        } catch {
          // Invalid article links lose navigation but must not discard the article.
          anchor.removeAttr('href');
        }
      }
    });
    resolvedHtml = fragment.html();
  }
  const processedHtml = sanitizeWechatHtml(resolvedHtml);

  // 3. Wrap in container for CSS matching
  const wrappedHtml = `<div class="markdown-body">${processedHtml}</div>`;

  // 4. Layer capability base CSS under the theme (and customCss on top)
  const themeCss = getTheme(options.theme, options.customCss);
  const css = [...(options.baseCss ?? []), themeCss].join('\n');

  // 5. Juice CSS Inlining
  const inlined = juice.inlineContent(wrappedHtml, css, {
    inlinePseudoElements: true,
    preserveImportant: true,
  });

  // 6. Patch WeChat DOM quirks & clean attributes
  let finalHtml = cleanWechatAttributes(inlined);
  finalHtml = patchWechatListBullets(finalHtml);

  return finalHtml;
}
