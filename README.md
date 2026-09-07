<div align="center">

# wechat-markdown

<p align="center">
  <strong>High-fidelity Markdown to WeChat Official Account HTML converter SDK & middleware</strong>
  <br />
  <strong>微信公众号 Markdown 格式化排版转换器 · 无头 TypeScript SDK</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rbbtsn0w/wechat-markdown"><img src="https://img.shields.io/npm/v/@rbbtsn0w/wechat-markdown.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://github.com/RbBtSn0w/wechat-markdown/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/RbBtSn0w/wechat-markdown/ci.yml?style=flat-square&label=CI" alt="Build Status" /></a>
  <a href="https://www.npmjs.com/package/@rbbtsn0w/wechat-markdown"><img src="https://img.shields.io/npm/dm/@rbbtsn0w/wechat-markdown?style=flat-square&color=success" alt="Downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-ISC-green.svg?style=flat-square" alt="License" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
</p>

</div>

---

**wechat-markdown** is an extensible, headless TypeScript SDK and middleware designed to convert Markdown documents into pixel-perfect, WeChat Official Account (微信公众号) compatible HTML. It solves pervasive WeChat editor rendering quirks with inlined CSS styles via `juice`, automatic external link-to-footnote conversion, MathJax LaTeX mathematical formulas, Kroki/Mermaid diagrams, and mobile-responsive layouts.

> **wechat-markdown** 是专为微信公众平台（WeChat Official Accounts）设计的无头 Markdown 排版转换引擎与中间件。通过 CSS 行内化处理、消除列表多余黑点（Phantom Bullets）、外链自动转底部脚注、Mac 风格代码块、自适应横向滚动表格、LaTeX 数学公式与 Mermaid 流程图渲染，助你一键生成可直接粘贴至微信公众平台的纯净 HTML 文章。

---

## 📑 Table of Contents

- [🌟 Highlights](#highlights)
- [📦 Installation](#installation)
- [🚀 Quick Start](#quick-start)
  - [Functional API](#functional-api)
  - [Class-based Engine](#class-based-engine)
- [🎨 Theming: Two Layers](#theming-two-layers)
  - [Passing a Theme Without Touching the Global Registry](#passing-a-theme-without-touching-the-global-registry)
- [🔌 Injecting Render Services](#injecting-render-services)
- [🚢 Release Workflow](#release-workflow)
- [🧪 Testing & Verification](#testing--verification)
- [🛠️ Build](#build)
- [📄 License](#license)

---

## 🌟 Highlights

- 🎨 **Multi-Theme System (多套精选主题)**: Built-in `tech` (Modern Blue), `grace` (Morandi Green), and `geek` (High Contrast Orange/Dark) themes with zero-config two-layer styling and `customCss` overrides.
- 📱 **WeChat Quirks Fixed (针对微信排版引擎修复)**:
  - **Eliminates Phantom Bullets**: Strips `\n` whitespace around `<li>` tags so WeChat doesn't render unwanted stray bullet dots.
  - **Class & ID Sanitization**: Sanitizes forbidden IDs and classes while preserving computed inline `style` attributes.
- 🔗 **Automatic Footnotes (外链自动转脚注)**: WeChat restricts direct outbound hyperlinks; `wechat-markdown` transforms `[Text](URL)` into `Text[1]` and automatically compiles a clean reference list at the article's footer.
- 💻 **Mac-Style Code Blocks (Mac 风格代码高亮容器)**: Elegant macOS terminal header with red, yellow, and green dots, language badges, and smooth horizontal scrolling containers.
- 📊 **Responsive Tables (自适应移动端表格)**: Wraps Markdown tables in `-webkit-overflow-scrolling: touch` wrappers to prevent narrow screen layout collapse on iOS and Android.
- 🧮 **LaTeX & Mermaid (数学公式与图表)**: Seamlessly renders inline `$...$` and block `$$...$$` MathJax formulas, alongside Mermaid diagrams (with fallback degradation).
- 🔌 **Async Image Resolver Hook (自定义图片上传/CDN 钩子)**: Pluggable async pipeline to upload local assets to your object storage / CDN before compiling the final HTML.

---

## 📦 Installation

Install via npm / pnpm / yarn:

```bash
# npm
npm install @rbbtsn0w/wechat-markdown

# pnpm
pnpm add @rbbtsn0w/wechat-markdown

# yarn
yarn add @rbbtsn0w/wechat-markdown
```

For GitHub Packages, add the scope-specific registry to `.npmrc` before installing:

```ini
@rbbtsn0w:registry=https://npm.pkg.github.com
```

```bash
npm install @rbbtsn0w/wechat-markdown
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
  theme: 'tech', // 'tech' | 'grace' | 'geek' | ThemeConfig
  footnoteLinks: true, // Convert external links to footnotes
  macCodeBlock: true, // Add Mac styling to code blocks
  tableScroller: true, // Responsive table wrappers
  resolveImage: async (src, alt) => {
    // Optional: upload local image to CDN and return remote URL
    return src;
  },
});

console.log(result.html); // WeChat-ready inline HTML
console.log(result.title); // "Getting Started"
console.log(result.footnotes); // Footnote items
```

### Class-based Engine

```typescript
import { WechatMarkdownEngine } from '@rbbtsn0w/wechat-markdown';

const engine = new WechatMarkdownEngine();
const result = await engine.render(markdown, { theme: 'grace' });
```

## 🎨 Theming: Two Layers

Styling is applied in two layers, concatenated in this order before `juice`
inlines them:

| Layer                     | Content                                                                                                                                                                                | Owner                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Capability base CSS**   | Structural rules for the markup each enabled capability emits (`.mac-code-wrapper`, `.gfm-alert*`, `.table-scroller`, `.footnote*`, `.wm-formula-*`, `.wm-mermaid`), in neutral colors | Ships with the capability |
| **Theme (+ `customCss`)** | Brand appearance — colors, type scale, spacing                                                                                                                                         | You                       |

A theme therefore only has to declare what it wants to _change_. A 20-line
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

### Passing a Theme Without Touching the Global Registry

`registerTheme(name, css)` mutates a process-global registry, so two consumers
in one process overwrite each other. Prefer passing the config inline:

```typescript
import { renderMarkdownToWechat, ThemeConfig } from '@rbbtsn0w/wechat-markdown';

const brand: ThemeConfig = { name: 'brand', css: '.markdown-body { color: #222; }' };
const result = await renderMarkdownToWechat(markdown, { theme: brand });
```

Unknown theme names fall back to `tech` rather than throwing.

## 🔌 Injecting Render Services

The engine owns the _orchestration_ of formulas and diagrams (finding them,
substituting an `<img>`, counting, emitting diagnostics). It does not need to
own the _asset lifecycle_. If your app renders, hashes, caches and uploads its
own images, inject a service instead of disabling the capability:

```typescript
const result = await renderMarkdownToWechat(markdown, {
  renderMath: true,
  services: {
    formulaRenderer: {
      async renderToImage(expression, display) {
        const png = await myRenderer.render(expression, display);
        return await myCdn.upload(png); // returns a final URL
      },
    },
  },
});
```

The string a service returns is **substituted into `src` verbatim** — a local
path, a `data:` URI, and an already-uploaded CDN URL are all valid. Omit
`services` to use the built-in MathJax and Kroki renderers.

For plain (non-generated) images, use the `resolveImage` hook instead.

## 🚢 Release Workflow

Releases from `main` publish to npm using trusted publishing and GitHub Packages using `GITHUB_TOKEN`. A package that has never been published to npm must be bootstrapped manually because it has no npm settings page yet:

```bash
npm login
npm whoami
npm publish --dry-run --access public
npm publish --access public
```

After that first publish succeeds, configure the package's trusted publisher on npmjs.com with:

- GitHub user: `RbBtSn0w`
- Repository: `wechat-markdown`
- Workflow: `release.yml`
- Allowed action: `npm publish`

The workflow uses GitHub Actions OIDC and requires no npm publish token. Future releases from this public repository automatically create npm provenance attestations.

## 🧪 Testing & Verification

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Static type check
npm run typecheck

# Code style lint
npm run lint

# Check production dependencies security
npm run audit:prod
```

## 🛠️ Build

```bash
npm run build
```

## 📄 License

ISC © [RbBtSn0w](https://github.com/RbBtSn0w)
