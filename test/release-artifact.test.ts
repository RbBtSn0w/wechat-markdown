import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { manifest, registryAdapter } = require('../scripts/release/artifact.cjs');
const { verifyConditions } = require('../scripts/release/plugin.cjs');
const temporary: string[] = [];
afterEach(() =>
  temporary.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })),
);
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'release-test-'));
  temporary.push(directory);
  mkdirSync(join(directory, 'package/dist'), { recursive: true });
  writeFileSync(
    join(directory, 'package/package.json'),
    JSON.stringify({ name: 'pkg', version: '2.0.0' }),
  );
  writeFileSync(join(directory, 'package/dist/index.js'), 'module.exports = 42;');
  const tarball = join(directory, 'package.tgz');
  execFileSync('tar', ['-czf', tarball, '-C', directory, 'package']);
  return { directory, tarball };
}
describe('release artifact boundary', () => {
  it('waits for post-publish metadata propagation before downloading and verifying content', async () => {
    const { tarball } = fixture();
    const wait = vi.fn(async () => {});
    let views = 0;
    const adapter = registryAdapter(
      { name: 'pkg', version: '2.0.0' },
      '.',
      (command: string, args: string[]) => {
        if (command === 'tar') return execFileSync(command, args, { encoding: 'utf8' });
        if (args[0] === 'view' && ++views < 3)
          throw Object.assign(new Error('missing'), { stderr: 'E404 not found' });
        if (args[0] === 'pack') {
          copyFileSync(tarball, join(args[args.indexOf('--pack-destination') + 1], 'download.tgz'));
          return JSON.stringify([{ filename: 'download.tgz' }]);
        }
        return '"integrity"';
      },
      wait,
    );
    expect(await adapter.inspect('npm', { attempts: 6 })).toEqual(manifest(tarball).files);
    expect(views).toBe(3);
    expect(wait.mock.calls).toEqual([[10000], [10000]]);
  });
  it('bounds propagation retries and never retries authentication failures', async () => {
    const wait = vi.fn(async () => {});
    const missing = vi.fn(() => {
      throw Object.assign(new Error('missing'), { stderr: 'E404 not found' });
    });
    const absent = registryAdapter({}, '.', missing, wait);
    expect(await absent.inspect('npm')).toBeNull();
    expect(missing).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    expect(await absent.inspect('npm', { attempts: 3 })).toBeNull();
    expect(missing).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenCalledTimes(2);
    const denied = vi.fn(() => {
      throw Object.assign(new Error('denied'), { stderr: 'E401 unauthorized' });
    });
    await expect(
      registryAdapter({}, '.', denied, wait).inspect('npm', { attempts: 6 }),
    ).rejects.toThrow('denied');
    expect(denied).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledTimes(2);
  });
  it('downloads and compares registry package contents, not publication receipt claims', async () => {
    const { tarball } = fixture();
    const commands: string[][] = [];
    const run = (command: string, args: string[]) => {
      if (command === 'tar') return execFileSync(command, args, { encoding: 'utf8' });
      commands.push(args);
      if (args[0] === 'view') return '"sha512-server-value"';
      if (args[0] === 'pack') {
        copyFileSync(tarball, join(args[args.indexOf('--pack-destination') + 1], 'download.tgz'));
        return JSON.stringify([{ filename: 'download.tgz' }]);
      }
      return '';
    };
    const adapter = registryAdapter(
      { name: 'pkg', version: '2.0.0', tarball: 'package.tgz' },
      '.',
      run,
    );
    expect(await adapter.inspect('github')).toEqual(manifest(tarball).files);
    expect(commands[0]).toContain('https://npm.pkg.github.com');
    expect(commands[1]).toContain('--ignore-scripts');
  });
  it('fails closed on authorization errors and accepts only E404 as missing', async () => {
    const denied = registryAdapter({}, '.', () => {
      throw Object.assign(new Error('denied'), { stderr: 'E401 unauthorized' });
    });
    await expect(denied.inspect('npm')).rejects.toThrow('denied');
    const absent = registryAdapter({}, '.', () => {
      throw Object.assign(new Error('missing'), { stderr: 'E404 not found' });
    });
    expect(await absent.inspect('npm')).toBeNull();
  });
  it('dispatches registry-specific auth/provenance and explicitly disables lifecycle scripts', async () => {
    const commands: string[][] = [];
    const adapter = registryAdapter(
      { tarball: 'saved.tgz' },
      '/saved',
      (_command: string, args: string[]) => {
        commands.push(args);
        return '';
      },
    );
    await adapter.publish('npm');
    await adapter.publish('github');
    expect(commands[0]).toContain('--provenance');
    expect(commands[1]).not.toContain('--provenance');
    expect(commands.every((args) => args.includes('--ignore-scripts'))).toBe(true);
  });
  it('rejects missing App credentials before stable release metadata is changed', async () => {
    const before = {
      ref: process.env.GITHUB_REF,
      bot: process.env.RELEASE_BOT_TOKEN,
      token: process.env.GITHUB_TOKEN,
    };
    try {
      process.env.GITHUB_REF = 'refs/heads/main';
      delete process.env.RELEASE_BOT_TOKEN;
      await expect(verifyConditions()).rejects.toThrow('credentials');
    } finally {
      for (const [key, value] of Object.entries({
        GITHUB_REF: before.ref,
        RELEASE_BOT_TOKEN: before.bot,
        GITHUB_TOKEN: before.token,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});

describe('release event ordering', () => {
  it('waits when Release finishes before CI and merges when the later CI event has passed checks', () => {
    const { directory } = fixture();
    const fakeGH = join(directory, 'gh');
    const pr = join(directory, 'pr.json');
    const merged = join(directory, 'merged');
    require('node:fs').writeFileSync(
      fakeGH,
      `#!${process.execPath}\nconst fs = require('node:fs'); if (process.argv[3] === 'view') process.stdout.write(fs.readFileSync(process.env.TEST_PR)); else fs.writeFileSync(process.env.TEST_MERGED, 'merged');\n`,
      { mode: 0o755 },
    );
    const sha = 'a'.repeat(40);
    const info = {
      baseRefName: 'main',
      headRefName: 'develop',
      headRefOid: sha,
      isCrossRepository: false,
      mergeable: 'MERGEABLE',
      statusCheckRollup: [] as unknown[],
    };
    const env = {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      TEST_PR: pr,
      TEST_MERGED: merged,
      GITHUB_REPOSITORY: 'RbBtSn0w/wechat-markdown',
    };
    const invoke = () =>
      execFileSync(process.execPath, ['scripts/release/pr.cjs', 'merge', '12', sha], {
        cwd: process.cwd(),
        env,
        encoding: 'utf8',
      });
    writeFileSync(pr, JSON.stringify(info));
    expect(invoke()).toContain('pending');
    expect(require('node:fs').existsSync(merged)).toBe(false);
    info.statusCheckRollup = ['Verify gate', 'Validate base branch'].map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    }));
    writeFileSync(pr, JSON.stringify(info));
    invoke();
    expect(require('node:fs').readFileSync(merged, 'utf8')).toBe('merged');
  });
});

describe('workflow completion subscriptions', () => {
  it('merges once when PR Target Branch finishes after both CI and Release', () => {
    const { directory } = fixture();
    const file = (name: string) => join(directory, name);
    const repository = 'RbBtSn0w/wechat-markdown';
    const sha = 'a'.repeat(40);
    const sourceSHA = 'b'.repeat(40);
    const releaseRun = {
      id: 234,
      workflow_id: 9,
      name: 'Release',
      conclusion: 'success',
      head_branch: 'main',
      head_sha: sourceSHA,
      path: '.github/workflows/release.yml',
      event: 'push',
      repository: { full_name: repository },
      head_repository: { full_name: repository },
    };
    const candidate = {
      number: 12,
      head: { ref: `release-sync/${sha}`, sha, repo: { id: 1 } },
      base: { ref: 'develop', repo: { id: 1 } },
    };
    const info = {
      baseRefName: 'develop',
      headRefName: `release-sync/${sha}`,
      headRefOid: sha,
      isCrossRepository: false,
      mergeable: 'MERGEABLE',
      statusCheckRollup: [{ name: 'Verify gate', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    };
    writeFileSync(file('run.json'), JSON.stringify(releaseRun));
    writeFileSync(
      file('receipt.json'),
      JSON.stringify({
        releaseSHA: sha,
        syncBranch: `release-sync/${sha}`,
        syncPR: 12,
        syncAuthorizationRunId: '234',
        syncAuthorizationSHA: sourceSHA,
        registries: { npm: 'verified', github: 'verified' },
      }),
    );
    writeFileSync(file('pr.json'), JSON.stringify(info));
    writeFileSync(
      file('gh'),
      `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const read = (name) => JSON.parse(fs.readFileSync(process.env.TEST_DIRECTORY + '/' + name, 'utf8'));
if (args[0] === 'api') {
  const endpoint = args[1];
  let result;
  if (endpoint.includes('/git/ref/heads/')) result = { object: { sha: '${sha}' } };
  else if (endpoint.endsWith('/actions/workflows/release.yml')) result = { id: 9 };
  else if (endpoint.includes('/actions/workflows/release.yml/runs?')) result = { workflow_runs: [read('run.json')] };
  else if (endpoint.endsWith('/artifacts')) result = { artifacts: [{ name: 'release-complete', expired: false }] };
  else result = { head_sha: '${sha}' };
  process.stdout.write(JSON.stringify(result));
} else if (args[0] === 'run') {
  fs.copyFileSync(process.env.TEST_DIRECTORY + '/receipt.json', args[args.indexOf('--dir') + 1] + '/receipt.json');
} else if (args[1] === 'list') process.stdout.write(JSON.stringify([{ number: 13, ...read('pr.json') }, { number: 12, ...read('pr.json') }]));
else if (args[1] === 'view') process.stdout.write(JSON.stringify(read('pr.json')));
else if (args[1] === 'merge') fs.appendFileSync(process.env.TEST_DIRECTORY + '/merged', 'merged\\n');
else throw new Error('Unexpected external call');
`,
      { mode: 0o755 },
    );
    writeFileSync(file('git'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const workflows = require('yaml').parse(
      require('node:fs').readFileSync('.github/workflows/release-pr-automerge.yml', 'utf8'),
    ).on.workflow_run.workflows as string[];
    const invoke = (name: string, developPush = false) => {
      if (!workflows.includes(name)) return;
      writeFileSync(
        file('event.json'),
        JSON.stringify({
          workflow_run:
            name === 'Release'
              ? releaseRun
              : {
                  id: name === 'CI' ? 100 : 101,
                  name,
                  event: developPush ? 'push' : 'pull_request',
                  head_branch: developPush ? 'develop' : candidate.head.ref,
                  pull_requests: developPush ? [] : [candidate],
                },
        }),
      );
      execFileSync(process.execPath, ['scripts/release/automerge.cjs'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          EVENT_PATH: file('event.json'),
          TEST_DIRECTORY: directory,
          GITHUB_REPOSITORY: repository,
        },
      });
    };
    invoke('CI');
    invoke('CI', true);
    invoke('Release');
    expect(require('node:fs').existsSync(file('merged'))).toBe(false);
    info.statusCheckRollup.push({
      name: 'Validate base branch',
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    });
    writeFileSync(file('pr.json'), JSON.stringify(info));
    invoke('PR Target Branch');
    expect(require('node:fs').readFileSync(file('merged'), 'utf8')).toBe('merged\n');
    expect(workflows).toContain('PR Target Branch');
  });
});
