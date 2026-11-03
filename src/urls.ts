/** Validate before resolving URLs so a base cannot introduce an unsafe scheme. */
export function validateSiteUrl(siteUrl?: string): URL | undefined {
  if (siteUrl === undefined) return undefined;
  try {
    const url = new URL(siteUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new TypeError('Invalid siteUrl');
    }
    return url;
  } catch {
    throw new TypeError('siteUrl must be an absolute HTTP(S) URL without credentials.');
  }
}
