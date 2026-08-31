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
  theme: 'tech',           // 'tech' | 'grace' | 'geek'
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
