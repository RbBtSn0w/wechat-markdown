/**
 * Image Figure and Caption Plugin for WeChat Official Accounts.
 *
 * Wraps Markdown images in dedicated figure containers and renders
 * accessible, stylized captions from image title or alt attributes.
 */

export const imageFigureBaseCss = `
.wm-image-figure {
  text-align: center !important;
  margin: 1.5em 0 !important;
}

.wm-image-figure img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
  margin: 0 auto;
}

.wm-image-caption {
  display: block !important;
  text-align: center !important;
  font-size: 13px !important;
  color: #888888 !important;
  margin-top: 6px !important;
  line-height: 1.5 !important;
}
`;

export function processImageFigures(html: string, enabled: boolean = true): string {
  if (!enabled) {
    return html;
  }

  // Find paragraphs that contain only an image: <p><img ...></p>
  // Avoid formulas and mermaid figures that already have special classes
  const pImgRegex = /<p>(\s*<img\b(?![^>]*(?:wm-formula|wm-mermaid))[^>]*src="([^"]+)"[^>]*>)\s*<\/p>/gi;

  return html.replace(pImgRegex, (match, fullImgTag) => {
    // Extract title or alt
    const titleMatch = fullImgTag.match(/\btitle="([^"]+)"/i);
    const altMatch = fullImgTag.match(/\balt="([^"]+)"/i);
    const captionText = titleMatch?.[1] || altMatch?.[1];

    if (captionText && captionText.trim() && !captionText.includes("http")) {
      return `<p class="wm-image-figure">${fullImgTag}<span class="wm-image-caption">${captionText.trim()}</span></p>`;
    }

    return `<p class="wm-image-figure">${fullImgTag}</p>`;
  });
}
