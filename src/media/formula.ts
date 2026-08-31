import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import sharp from 'sharp';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';

export class FormulaRenderer {
  private tempDir: string;

  constructor(tempDir?: string) {
    this.tempDir = tempDir || path.join(os.tmpdir(), 'wechat-markdown-formulas');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  getHash(expression: string, display: boolean): string {
    return crypto.createHash('sha256').update(`${display ? 'display' : 'inline'}:${expression}`).digest('hex');
  }

  getTargetPath(hash: string): string {
    return path.join(this.tempDir, `${hash}.png`);
  }

  async renderToImage(expression: string, display: boolean): Promise<string> {
    const hash = this.getHash(expression, display);
    const targetPath = this.getTargetPath(hash);
    if (fs.existsSync(targetPath)) {
      return targetPath;
    }

    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const tex = new TeX({ packages: ['base', 'ams'] });
    const svgOutput = new SVG({ fontCache: 'none' });
    const document = mathjax.document('', { InputJax: tex, OutputJax: svgOutput });
    const node = document.convert(expression, { display });
    const rendered = adaptor.outerHTML(node);
    const svg = rendered.match(/<svg[\s\S]*<\/svg>/)?.[0];
    if (!svg) {
      throw new Error('MathJax did not produce an SVG image.');
    }

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    fs.writeFileSync(targetPath, png);
    return targetPath;
  }
}
