import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';
const require = createRequire(import.meta.url);

describe('release metadata commit CI', () => {
  it('uses no global CI-skip directive and classifies before the stable job', () => {
    const plugin = readFileSync('scripts/release/plugin.cjs', 'utf8');
    expect(plugin).not.toMatch(/\[skip ci\]/i);
    const workflow = parse(readFileSync('.github/workflows/release.yml', 'utf8'));
    expect(workflow.jobs['classify-push'].permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs.release.needs).toBe('classify-push');
    expect(workflow.jobs.release.if).toContain("needs.classify-push.outputs.metadata != 'true'");
    expect(workflow.concurrency['cancel-in-progress']).toBe(false);
    for (const file of ['ci.yml', 'pr-target.yml']) {
      const gate = parse(readFileSync(`.github/workflows/${file}`, 'utf8'));
      expect(gate.on.pull_request).toBeDefined();
      expect(JSON.stringify(gate)).not.toContain('release-metadata');
    }
  });
  it('only skips a trusted App push containing strictly validated metadata changes', () => {
    const { isMetadataPush, metadataMessage } = require('../scripts/release/metadata.cjs');
    const sha = 'a'.repeat(40);
    const parent = 'b'.repeat(40);
    const event = {
      ref: 'refs/heads/main',
      before: parent,
      after: sha,
      sender: { login: 'rbbtsn0w-bot[bot]', type: 'Bot' },
      head_commit: { id: sha, message: metadataMessage('2.0.0') },
    };
    const before = { name: 'pkg', version: '1.0.0', dependencies: { example: '^1' } };
    const changes = [
      { path: 'package.json', before, after: { ...before, version: '2.0.0' } },
      { path: 'CHANGELOG.md', before: '', after: '# 2.0.0' },
    ];
    const commit = { sha, parents: [parent], message: metadataMessage('2.0.0'), changes };
    const context = { eventName: 'push', actor: 'rbbtsn0w-bot[bot]' };
    expect(metadataMessage('2.0.0')).toBe('chore(release): 2.0.0 [release-metadata]');
    expect(isMetadataPush(event, commit, context)).toBe(true);
    expect(
      isMetadataPush(
        event,
        { ...commit, changes: [...changes, { path: 'src/index.ts', before: '', after: 'unsafe' }] },
        context,
      ),
    ).toBe(false);
    expect(
      isMetadataPush(
        event,
        {
          ...commit,
          changes: [
            {
              path: 'package.json',
              before,
              after: { ...before, version: '2.0.0', dependencies: { example: '^2' } },
            },
          ],
        },
        context,
      ),
    ).toBe(false);
    expect(isMetadataPush(event, commit, { ...context, actor: 'someone' })).toBe(false);
    expect(
      isMetadataPush({ ...event, sender: { login: 'someone', type: 'User' } }, commit, context),
    ).toBe(false);
    expect(isMetadataPush(event, { ...commit, parents: [parent, 'c'.repeat(40)] }, context)).toBe(
      false,
    );
    expect(
      isMetadataPush(event, { ...commit, message: `${commit.message}\n\n[skip ci]` }, context),
    ).toBe(false);
    expect(isMetadataPush(event, commit, { ...context, eventName: 'workflow_dispatch' })).toBe(
      false,
    );
  });
  it('classifies real commits without changing the original metadata SHA or its PR checks', () => {
    const directory = mkdtempSync(join(tmpdir(), 'release-metadata-'));
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
    try {
      git('init', '-b', 'main');
      git('config', 'user.name', 'Test');
      git('config', 'user.email', 'test@example.com');
      writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      git('add', 'package.json');
      git('commit', '-m', 'chore: initial');
      const parent = git('rev-parse', 'HEAD');
      writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '2.0.0' }));
      git('add', 'package.json');
      git('commit', '-m', 'chore(release): 2.0.0 [release-metadata]');
      const sha = git('rev-parse', 'HEAD');
      const event = join(directory, 'event.json');
      const output = join(directory, 'output');
      writeFileSync(
        event,
        JSON.stringify({
          ref: 'refs/heads/main',
          before: parent,
          after: sha,
          sender: { login: 'rbbtsn0w-bot[bot]', type: 'Bot' },
          head_commit: { id: sha, message: 'chore(release): 2.0.0 [release-metadata]' },
        }),
      );
      const script = join(process.cwd(), 'scripts/release/metadata.cjs');
      const env = {
        ...process.env,
        GITHUB_EVENT_PATH: event,
        GITHUB_OUTPUT: output,
        GITHUB_EVENT_NAME: 'push',
        GITHUB_ACTOR: 'rbbtsn0w-bot[bot]',
      };
      execFileSync(process.execPath, [script], { cwd: directory, env });
      expect(readFileSync(output, 'utf8')).toBe('metadata=true\n');
      expect(git('rev-parse', 'HEAD')).toBe(sha);
      mkdirSync(join(directory, 'src'));
      writeFileSync(join(directory, 'src/index.js'), 'module.exports = 42;');
      git('add', 'src/index.js');
      git('commit', '-m', 'chore(release): 2.0.0 [release-metadata]');
      const codeSHA = git('rev-parse', 'HEAD');
      writeFileSync(
        event,
        JSON.stringify({
          ref: 'refs/heads/main',
          before: sha,
          after: codeSHA,
          sender: { login: 'rbbtsn0w-bot[bot]', type: 'Bot' },
          head_commit: { id: codeSHA, message: 'chore(release): 2.0.0 [release-metadata]' },
        }),
      );
      writeFileSync(output, '');
      execFileSync(process.execPath, [script], { cwd: directory, env });
      expect(readFileSync(output, 'utf8')).toBe('metadata=false\n');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
