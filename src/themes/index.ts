import { techTheme } from './tech';
import { graceTheme } from './grace';
import { geekTheme } from './geek';
import { ThemeConfig } from '../types';

const themeRegistry: Record<string, ThemeConfig> = {
  tech: {
    name: 'tech',
    description: 'Modern Tech Blue Theme (Default)',
    css: techTheme,
  },
  grace: {
    name: 'grace',
    description: 'Elegant Morandi Green Theme',
    css: graceTheme,
  },
  geek: {
    name: 'geek',
    description: 'High Contrast Orange & Dark Accent Geek Theme',
    css: geekTheme,
  },
};

/**
 * Resolve theme CSS from a registered name or an inline ThemeConfig.
 *
 * Unknown names intentionally fall back to `tech` rather than throwing:
 * downstream configs are known to carry names that were never registered, and
 * they rely on this fallback. Any strictness here must be opt-in.
 */
export function getTheme(theme: string | ThemeConfig = 'tech', customCss?: string): string {
  const selected =
    typeof theme === 'string'
      ? themeRegistry[theme.toLowerCase()] || themeRegistry.tech
      : theme;
  if (customCss) {
    return `${selected.css}\n${customCss}`;
  }
  return selected.css;
}

export function listThemes(): ThemeConfig[] {
  return Object.values(themeRegistry);
}

export function registerTheme(name: string, css: string, description?: string): void {
  themeRegistry[name.toLowerCase()] = { name, css, description };
}
