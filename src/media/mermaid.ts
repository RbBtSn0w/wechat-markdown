import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import axios from 'axios';
import pako from 'pako';
import sharp from 'sharp';

export interface MermaidRendererOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export class MermaidRenderer {
  private tempDir: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(tempDir?: string, options?: MermaidRendererOptions) {
    this.tempDir = tempDir || path.join(os.tmpdir(), 'wechat-markdown-mermaid');
    this.timeoutMs = options?.timeoutMs ?? 30000;
    this.maxRetries = options?.maxRetries ?? 3;
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  getHash(mermaidCode: string): string {
    return crypto.createHash('md5').update(mermaidCode.trim()).digest('hex');
  }

  getTargetPath(hash: string): string {
    return path.join(this.tempDir, `${hash}.png`);
  }

  /**
   * Preprocesses mermaid code to quote unquoted node labels with special characters like &, ?, (, )
   */
  sanitizeMermaid(code: string): string {
    return code
      .replace(/\[([^\]"'\n]+[&?()][^\]"'\n]*)\]/g, '["$1"]')
      .replace(/\{([^}"'\n]+[&?()][^}"'\n]*)\}/g, '{"$1"}');
  }

  async renderToImage(mermaidCode: string): Promise<string> {
    const hash = this.getHash(mermaidCode);
    const targetPath = this.getTargetPath(hash);

    if (fs.existsSync(targetPath)) {
      return targetPath;
    }

    const sanitized = this.sanitizeMermaid(mermaidCode.trim());
    const data = Buffer.from(sanitized, 'utf8');
    const compressed = pako.deflate(data, { level: 9 });
    const result = Buffer.from(compressed)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const urls = [
      `https://kroki.io/mermaid/png/${result}`,
      `https://kroki.io/mermaid/svg/${result}`,
    ];

    let lastError: any = null;

    for (const url of urls) {
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const isSvg = url.includes('/svg/');
          const response = await axios.get(url, {
            responseType: isSvg ? 'text' : 'arraybuffer',
            timeout: this.timeoutMs,
          });

          if (isSvg) {
            const svgBuffer = Buffer.from(response.data as string, 'utf8');
            await sharp(svgBuffer).png({ quality: 95 }).toFile(targetPath);
          } else {
            fs.writeFileSync(targetPath, response.data as Buffer);
          }

          return targetPath;
        } catch (err: any) {
          lastError = err;
          if (attempt < this.maxRetries) {
            await new Promise((res) => setTimeout(res, 1000 * attempt));
          }
        }
      }
    }

    throw new Error(
      `Failed to render Mermaid diagram after retries: ${lastError?.message || 'Unknown error'}`
    );
  }
}
