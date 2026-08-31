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

export function getTheme(name: string = 'tech', customCss?: string): string {
  const selected = themeRegistry[name.toLowerCase()] || themeRegistry.tech;
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
