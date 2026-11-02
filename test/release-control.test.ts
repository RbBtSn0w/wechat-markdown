import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  publishRegistries,
  validateRecovery,
  validateMetadata,
  validatePullRequest,
  extractClosingReferences,
  validateSyncAuthorization,
} = require('../scripts/release/control.cjs');

const manifest = { 'package/package.json': 'abc', 'package/dist/index.js': 'def' };
const receipt = () => ({
  schema: 1,
  runId: '123',
  sourceSHA: 'a'.repeat(40),
  version: '2.0.0',
  name: '@rbbtsn0w/wechat-markdown',
  tarball: 'release.tgz',
  manifest,
  registries: {} as Record<string, unknown>,
});
function registryAdapter(existing: Record<string, unknown> = {}, failed = '') {
  const published: string[] = [];
  return {
    published,
    inspect: async (registry: string) => existing[registry] || null,
    publish: async (registry: string) => {
      if (registry === failed) throw new Error('denied');
      published.push(registry);
      existing[registry] = manifest;
    },
  };
}
describe('release control', () => {
  it('propagates unique issue-closing references from commits and associated PR bodies', () => {
    expect(
      extractClosingReferences([
        'fix: task\nCloses #9, #3\nReferences #88',
        'Resolves: #3\nFixes #12',
      ]),
    ).toEqual(['#3', '#9', '#12']);
  });

  it('publishes missing registries and verifies actual content', async () => {
    const adapter = registryAdapter();
    const result = await publishRegistries(receipt(), adapter);
    expect(adapter.published).toEqual(['npm', 'github']);
    expect(result.registries).toEqual({ npm: 'verified', github: 'verified' });
  });
  it('accepts a preview when one registry verifies and fails when both fail', async () => {
    const state = { ...receipt(), channel: 'next' };
    await expect(publishRegistries(state, registryAdapter({}, 'npm'))).resolves.toBe(state);
    expect(state.registries.github).toBe('verified');
    await expect(
      publishRegistries(
        { ...receipt(), channel: 'next' },
        {
          inspect: async () => null,
          publish: async () => {
            throw new Error('denied');
          },
        },
      ),
    ).rejects.toThrow('denied');
  });
  it('reruns without overwriting matching package versions', async () => {
    const adapter = registryAdapter({ npm: manifest, github: manifest });
    await publishRegistries(receipt(), adapter);
    expect(adapter.published).toEqual([]);
  });
  it('preserves partial outcomes and recovers only the missing registry', async () => {
    const state = receipt();
    const existing: Record<string, unknown> = {};
    await expect(publishRegistries(state, registryAdapter(existing, 'github'))).rejects.toThrow(
      'denied',
    );
    expect(state.registries.npm).toBe('verified');
    const recovery = registryAdapter(existing);
    await publishRegistries(state, recovery);
    expect(recovery.published).toEqual(['github']);
  });
  it('rejects content mismatches without publishing or accepting receipt claims', async () => {
    const state = receipt();
    state.registries.npm = 'verified';
    const adapter = registryAdapter({ npm: { ...manifest, 'package/dist/index.js': 'changed' } });
    await expect(publishRegistries(state, adapter)).rejects.toThrow('content mismatch');
    expect(adapter.published).toEqual([]);
  });
  it('fails if post-publish inspection does not find the artifact', async () => {
    await expect(
      publishRegistries(receipt(), { inspect: async () => null, publish: async () => {} }),
    ).rejects.toThrow('verification');
  });
  it('validates recovery failed run provenance and unchanged source SHA', () => {
    const run = {
      id: 123,
      conclusion: 'failure',
      head_branch: 'main',
      head_sha: 'a'.repeat(40),
      path: '.github/workflows/release.yml',
      event: 'push',
      head_repository: { full_name: 'RbBtSn0w/wechat-markdown' },
      repository: { full_name: 'RbBtSn0w/wechat-markdown' },
    };
    expect(() =>
      validateRecovery(receipt(), run, 'RbBtSn0w/wechat-markdown', '2.0.0'),
    ).not.toThrow();
    expect(() =>
      validateRecovery(
        receipt(),
        { ...run, head_sha: 'b'.repeat(40) },
        'RbBtSn0w/wechat-markdown',
        '2.0.0',
      ),
    ).toThrow('provenance');
    expect(() => validateRecovery(receipt(), run, 'RbBtSn0w/wechat-markdown', '2.1.0')).toThrow(
      'version',
    );
    expect(() =>
      validateRecovery(
        receipt(),
        { ...run, conclusion: 'success' },
        'RbBtSn0w/wechat-markdown',
        '2.0.0',
      ),
    ).toThrow('failed');
  });
  it('rejects forged recovery events and fork source repositories', () => {
    const run = {
      id: 123,
      conclusion: 'failure',
      head_branch: 'main',
      head_sha: 'a'.repeat(40),
      path: '.github/workflows/release.yml',
      repository: { full_name: 'RbBtSn0w/wechat-markdown' },
      event: 'pull_request',
      head_repository: { full_name: 'fork/repo' },
    };
    expect(() => validateRecovery(receipt(), run, 'RbBtSn0w/wechat-markdown', '2.0.0')).toThrow(
      'provenance',
    );
  });
  it('authorizes sync only from successful trusted evidence bound to the PR and release SHA', () => {
    const sha = 'a'.repeat(40);
    const run = {
      id: 234,
      conclusion: 'success',
      head_branch: 'main',
      head_sha: sha,
      path: '.github/workflows/release.yml',
      event: 'push',
      repository: { full_name: 'RbBtSn0w/wechat-markdown' },
      head_repository: { full_name: 'RbBtSn0w/wechat-markdown' },
    };
    const evidence = {
      ...receipt(),
      releaseSHA: sha,
      syncPR: 12,
      syncAuthorizationRunId: '234',
      syncAuthorizationSHA: sha,
      registries: { npm: 'verified', github: 'verified' },
    };
    expect(() =>
      validateSyncAuthorization(undefined, run, 'RbBtSn0w/wechat-markdown', 12, sha),
    ).toThrow('authorization');
    expect(() =>
      validateSyncAuthorization(evidence, run, 'RbBtSn0w/wechat-markdown', 12, 'b'.repeat(40)),
    ).toThrow('authorization');
    expect(() =>
      validateSyncAuthorization(evidence, run, 'RbBtSn0w/wechat-markdown', 12, sha),
    ).not.toThrow();
  });
  it('allows only version metadata changes, including package-lock root version', () => {
    const before = { name: 'pkg', version: '1.0.0', dependencies: { x: '1' } };
    expect(() =>
      validateMetadata('package.json', before, { ...before, version: '2.0.0' }),
    ).not.toThrow();
    expect(() =>
      validateMetadata('package.json', before, { ...before, dependencies: { x: '2' } }),
    ).toThrow('metadata');
    const lock = { version: '1.0.0', packages: { '': before, 'node_modules/x': { version: '1' } } };
    expect(() =>
      validateMetadata('package-lock.json', lock, {
        ...lock,
        version: '2.0.0',
        packages: { ...lock.packages, '': { ...before, version: '2.0.0' } },
      }),
    ).not.toThrow();
    expect(() => validateMetadata('src/index.ts', {}, {})).toThrow('metadata');
  });
  it('rejects fork release PRs, conflicts, stale heads and missing required checks', () => {
    const pr = {
      baseRefName: 'main',
      headRefName: 'develop',
      headRefOid: 'abc',
      isCrossRepository: false,
      mergeable: 'MERGEABLE',
      statusCheckRollup: [{ name: 'required', conclusion: 'SUCCESS', status: 'COMPLETED' }],
    };
    expect(() => validatePullRequest(pr, 'abc', ['required'])).not.toThrow();
    expect(() =>
      validatePullRequest({ ...pr, isCrossRepository: true }, 'abc', ['required']),
    ).toThrow('repository');
    expect(() =>
      validatePullRequest({ ...pr, mergeable: 'CONFLICTING' }, 'abc', ['required']),
    ).toThrow('conflict');
    expect(() => validatePullRequest(pr, 'changed', ['required'])).toThrow('head');
    expect(() => validatePullRequest(pr, 'abc', ['missing'])).toThrow('checks');
  });
});
