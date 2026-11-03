import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const temporary: string[] = [];
afterEach(() =>
  temporary.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })),
);
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'sync-graph-'));
  temporary.push(directory);
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    }).trim();
  git('init', '-b', 'develop');
  const commit = (name: string) => {
    writeFileSync(join(directory, name), name);
    git('add', name);
    git('commit', '-m', name);
    return git('rev-parse', 'HEAD');
  };
  const base = commit('base');
  git('switch', '-c', 'main');
  const release = commit('metadata');
  git('switch', 'develop');
  const develop = commit('feature');
  git('switch', '-c', 'release-sync', release);
  return { git, commit, base, release, develop };
}
describe('verified release sync graph', () => {
  it('accepts only standard merges of develop and refreshes after develop advances', () => {
    const { verifySyncHead } = require('../scripts/release/sync.cjs');
    const { git, commit, release, develop } = fixture();
    expect(verifySyncHead(release, release, develop, git)).toBe(false);
    git('merge', '--no-ff', develop, '-m', 'sync');
    const first = git('rev-parse', 'HEAD');
    expect(verifySyncHead(release, first, develop, git)).toBe(true);
    git('switch', 'develop');
    const latest = commit('second-feature');
    git('switch', 'release-sync');
    expect(verifySyncHead(release, first, latest, git)).toBe(false);
    git('merge', '--no-ff', latest, '-m', 'refresh');
    expect(verifySyncHead(release, git('rev-parse', 'HEAD'), latest, git)).toBe(true);
  });
  it('refreshes an authorized branch without changing main and requires new candidate CI', () => {
    const { refreshSyncBranch } = require('../scripts/release/sync.cjs');
    const { git, commit, release, develop } = fixture();
    let head = release;
    let latest = develop;
    let merges = 0;
    const branch = `release-sync/${release}`;
    const receipt = { releaseSHA: release, syncBranch: branch };
    const api = (endpoint: string, fields?: { base: string; head: string }) => {
      if (endpoint === `git/ref/heads/${branch}`) return { object: { sha: head } };
      if (endpoint === 'git/ref/heads/develop') return { object: { sha: latest } };
      expect(endpoint).toBe('merges');
      expect(fields).toMatchObject({ base: branch, head: latest });
      const tree = git('merge-tree', '--write-tree', head, latest);
      head = git('commit-tree', tree, '-p', head, '-p', latest, '-m', 'sync');
      merges += 1;
      return { sha: head };
    };
    const run = (...args: string[]) => (args[0] === 'fetch' ? '' : git(...args));
    expect(refreshSyncBranch(receipt, api, run)).toEqual({ sha: head, updated: true });
    expect(refreshSyncBranch(receipt, api, run)).toEqual({ sha: head, updated: false });
    git('switch', 'develop');
    latest = commit('later-feature');
    expect(refreshSyncBranch(receipt, api, run)).toEqual({ sha: head, updated: true });
    expect(merges).toBe(2);
    expect(git('rev-parse', 'main')).toBe(release);
    expect(() => refreshSyncBranch({ ...receipt, syncBranch: 'main' }, api, run)).toThrow('branch');
  });
  it('rejects ordinary commits, forged merge trees and non-develop ancestry', () => {
    const { verifySyncHead } = require('../scripts/release/sync.cjs');
    const { git, commit, release, develop } = fixture();
    const injected = commit('injected');
    expect(() => verifySyncHead(release, injected, develop, git)).toThrow('sync');
    const tree = git('rev-parse', `${injected}^{tree}`);
    const forged = git('commit-tree', tree, '-p', release, '-p', develop, '-m', 'forged');
    expect(() => verifySyncHead(release, forged, develop, git)).toThrow('tree');
    const unrelated = git('commit-tree', tree, '-p', injected, '-p', develop, '-m', 'unrelated');
    expect(() => verifySyncHead(release, unrelated, develop, git)).toThrow('sync');
  });
  it('fails closed on conflicts rather than authorizing a resolution tree', () => {
    const { verifySyncHead } = require('../scripts/release/sync.cjs');
    const { git, commit, release, develop } = fixture();
    writeFileSync(join(temporary[temporary.length - 1], 'base'), 'release edit');
    git('add', 'base');
    git('commit', '-m', 'release conflict');
    const conflictingRelease = git('rev-parse', 'HEAD');
    git('switch', 'develop');
    writeFileSync(join(temporary[temporary.length - 1], 'base'), 'develop edit');
    git('add', 'base');
    git('commit', '-m', 'develop conflict');
    const conflictingDevelop = git('rev-parse', 'HEAD');
    const resolution = git(
      'commit-tree',
      git('rev-parse', `${conflictingRelease}^{tree}`),
      '-p',
      conflictingRelease,
      '-p',
      conflictingDevelop,
      '-m',
      'manual resolution',
    );
    expect(() => verifySyncHead(conflictingRelease, resolution, conflictingDevelop, git)).toThrow();
    const unrelated = commit('unrelated');
    expect(() => verifySyncHead(release, unrelated, develop, git)).toThrow('sync');
    const forged = git(
      'commit-tree',
      git('rev-parse', `${release}^{tree}`),
      '-p',
      release,
      '-p',
      develop,
      '-m',
      'drops feature',
    );
    expect(() => verifySyncHead(release, forged, develop, git)).toThrow('tree');
  });
});
