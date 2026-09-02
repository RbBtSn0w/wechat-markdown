# @rbbtsn0w/wechat-markdown

> High-fidelity Markdown to WeChat Official Account HTML converter SDK & middleware.

An extensible, headless TypeScript SDK designed to convert Markdown into pixel-perfect, WeChat Official Account compatible HTML with inlined CSS styles, footnotes, math rendering, and mobile-friendly layouts.

## 🌟 Highlights

- 🎨 **Multi-Theme System**: Built-in `tech` (Modern Blue), `grace` (Morandi Green), and `geek` (High Contrast Orange/Dark) themes with custom CSS support.
- 📱 **WeChat Quirks Fixed**:
  - Eliminates Phantom Bullets by stripping `\n` whitespace around `<li>` tags.
  - Sanitizes forbidden IDs and classes while preserving computed inline `style` attributes.
- 🔗 **Automatic Footnotes**: Converts external links `[Text](URL)` into `Text[1]` and automatically appends a formatted reference list at the bottom.
- 💻 **Mac-Style Code Blocks**: Elegant terminal headers with red, yellow, and green dots, language badges, and horizontal scroll containers.
- 📊 **Responsive Tables**: Wraps Markdown tables in `-webkit-overflow-scrolling: touch` containers to avoid narrow screen distortion on mobile.
- 🧮 **LaTeX & Mermaid**: Renders inline `$...$` and block `$$...$$` MathJax formulas, and Mermaid diagrams (with fallback degradation).
- 🔌 **Async Image Resolver Hook**: Allows injecting custom image uploading/CDN routing pipelines before final HTML generation.

## 📦 Installation

```bash
# Via GitHub Packages
npm install @rbbtsn0w/wechat-markdown --registry=https://npm.pkg.github.com
```

## 🚀 Quick Start

### Functional API

```typescript
import { renderMarkdownToWechat } from '@rbbtsn0w/wechat-markdown';

const markdown = `---
title: "Getting Started"
---

# Hello WeChat!

Here is an external link to [Google](https://google.com) and a code block:

\`\`\`typescript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`
`;

const result = await renderMarkdownToWechat(markdown, {
  theme: 'tech',           // 'tech' | 'grace' | 'geek' | ThemeConfig
  footnoteLinks: true,     // Convert external links to footnotes
  macCodeBlock: true,      // Add Mac styling to code blocks
  tableScroller: true,     // Responsive table wrappers
  resolveImage: async (src, alt) => {
    // Optional: upload local image to CDN and return remote URL
    return src;
  },
});

console.log(result.html);        // WeChat-ready inline HTML
console.log(result.title);       // "Getting Started"
console.log(result.footnotes);   // Footnote items
```

### Class-based Engine

```typescript
import { WechatMarkdownEngine } from '@rbbtsn0w/wechat-markdown';

const engine = new WechatMarkdownEngine();
const result = await engine.render(markdown, { theme: 'grace' });
```

## 🎨 Theming: two layers

Styling is applied in two layers, concatenated in this order before `juice`
inlines them:

| Layer | Content | Owner |
| --- | --- | --- |
| **Capability base CSS** | Structural rules for the markup each enabled capability emits (`.mac-code-wrapper`, `.gfm-alert*`, `.table-scroller`, `.footnote*`, `.wm-formula-*`, `.wm-mermaid`), in neutral colors | Ships with the capability |
| **Theme (+ `customCss`)** | Brand appearance — colors, type scale, spacing | You |

A theme therefore only has to declare what it wants to *change*. A 20-line
brand sheet that styles nothing but `.markdown-body` typography still renders
Mac code chrome and GFM alerts correctly, because the base layer supplies them.

Two rules when writing a theme or your own base CSS:

- **Base CSS must never use `!important`.** The theme is layered after it, and
  `!important` in the base layer would beat every brand override.
- **Beware element-scoped theme rules.** `.markdown-body img { ... }` and
  `.markdown-body blockquote { ... }` have specificity (0,1,1) and outrank a
  bare `.wm-formula-inline` or `.gfm-alert-note` (0,1,0) regardless of order.
  The affected base rules are therefore scoped one level higher —
  `.markdown-body img.wm-formula-inline` and
  `.markdown-body blockquote.gfm-alert-note` (0,2,1). To override them, match
  that specificity (all three built-in themes do) or use `!important`.

Each capability's base CSS is exported (`codeDecoratorBaseCss`,
`alertsBaseCss`, `tableScrollerBaseCss`, `footnotesBaseCss`, `formulaBaseCss`,
`mermaidBaseCss`) if you want to read the baseline you are overriding.

### Passing a theme without touching the global registry

`registerTheme(name, css)` mutates a process-global registry, so two consumers
in one process overwrite each other. Prefer passing the config inline:

```typescript
import { renderMarkdownToWechat, ThemeConfig } from '@rbbtsn0w/wechat-markdown';

const brand: ThemeConfig = { name: 'brand', css: '.markdown-body { color: #222; }' };
const result = await renderMarkdownToWechat(markdown, { theme: brand });
```

Unknown theme names fall back to `tech` rather than throwing.

## 🔌 Injecting render services

The engine owns the *orchestration* of formulas and diagrams (finding them,
substituting an `<img>`, counting, emitting diagnostics). It does not need to
own the *asset lifecycle*. If your app renders, hashes, caches and uploads its
own images, inject a service instead of disabling the capability:

```typescript
const result = await renderMarkdownToWechat(markdown, {
  renderMath: true,
  services: {
    formulaRenderer: {
      async renderToImage(expression, display) {
        const png = await myRenderer.render(expression, display);
        return await myCdn.upload(png);   // returns a final URL
      },
    },
  },
});
```

The string a service returns is **substituted into `src` verbatim** — a local
path, a `data:` URI, and an already-uploaded CDN URL are all valid. Omit
`services` to use the built-in MathJax and Kroki renderers.

For plain (non-generated) images, use the `resolveImage` hook instead.

## 🧪 Testing

```bash
npm test
```

## 🛠️ Build

```bash
npm run build
```

## 📄 License

ISC © [RbBtSn0w](https://github.com/RbBtSn0w)
