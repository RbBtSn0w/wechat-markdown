import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(path.join(tmpdir(), 'wechat-markdown-consumer-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

try {
  const [packed] = JSON.parse(
    run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary]),
  );
  for (const { path: file } of packed.files) {
    assert(
      /^dist\/.+\.(?:js|d\.ts|js\.map|d\.ts\.map)$/.test(file) ||
        ['package.json', 'README.md', 'LICENSE'].includes(file),
      `Unexpected package file: ${file}`,
    );
  }
  assert(packed.files.some(({ path: file }) => file === 'dist/index.js'));
  assert(packed.files.some(({ path: file }) => file === 'dist/index.d.ts'));
  writeFileSync(
    path.join(temporary, 'package.json'),
    JSON.stringify({ name: 'wechat-markdown-consumer-check', private: true }),
  );
  run(
    npm,
    [
      'install',
      path.join(temporary, packed.filename),
      '--omit=dev',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ],
    temporary,
  );
  writeFileSync(
    path.join(temporary, 'consumer.cjs'),
    `const assert = require('node:assert/strict');
const { renderMarkdownToWechat } = require('@rbbtsn0w/wechat-markdown');
(async () => {
  const result = await renderMarkdownToWechat('# Packed Consumer\\n\\nHello **package**.', {
    renderMath: false, renderMermaid: false,
  });
  assert.equal(result.title, 'Packed Consumer');
  assert.ok(result.html.includes('package'));
  assert.ok(result.html.includes('style="'));
  assert.ok(!result.html.includes('class="'));
})().catch(error => { console.error(error); process.exitCode = 1; });
`,
  );
  run(process.execPath, ['consumer.cjs'], temporary);
  writeFileSync(
    path.join(temporary, 'consumer.ts'),
    `import { renderMarkdownToWechat, RenderResult } from '@rbbtsn0w/wechat-markdown';
async function render(): Promise<RenderResult> {
  return renderMarkdownToWechat('# Typed Consumer', { renderMath: false, renderMermaid: false });
}
void render();
`,
  );
  writeFileSync(
    path.join(temporary, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        noEmit: true,
        strict: true,
        types: [],
      },
      files: ['consumer.ts'],
    }),
  );
  run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', temporary]);
  const installed = JSON.parse(
    readFileSync(
      path.join(temporary, 'node_modules/@rbbtsn0w/wechat-markdown/package.json'),
      'utf8',
    ),
  );
  console.log(`Packed consumer verified: ${installed.name}@${installed.version}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
