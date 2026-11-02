const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  validatePullRequest,
  extractClosingReferences,
  validateSyncAuthorization,
} = require('./control.cjs');
const artifact = require('./artifact.cjs');
const run = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', env: process.env }).trim();
const gh = (...args) => run('gh', args);
const readGH = (...args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN },
  }).trim();
const repository = process.env.GITHUB_REPOSITORY;
const requiredChecks = ['Verify gate', 'Validate base branch'];

async function create(kind) {
  const release = kind === 'release';
  const base = release ? 'main' : 'develop';
  const head = release ? 'develop' : 'main';
  if (!process.env.GH_TOKEN) throw new Error('Missing App token for PR CI trigger');
  const receipt = release ? null : artifact.load();
  if (receipt && !['npm', 'github'].every((key) => receipt.registries[key] === 'verified'))
    throw new Error('Sync requires verified registries');
  if (receipt) {
    const currentSHA = JSON.parse(readGH('api', `repos/${repository}/git/ref/heads/main`)).object
      .sha;
    if (currentSHA !== receipt.releaseSHA)
      throw new Error('Sync main head differs from verified release SHA');
  }
  const prs = JSON.parse(
    readGH(
      'pr',
      'list',
      '--repo',
      repository,
      '--base',
      base,
      '--head',
      head,
      '--state',
      'open',
      '--json',
      'number,isCrossRepository',
    ),
  );
  if (prs.some((pr) => pr.isCrossRepository)) throw new Error('Cross repository PR collision');
  let number = prs[0]?.number;
  const references = [];
  if (release) {
    run('git', ['fetch', 'origin', 'main', 'develop']);
    try {
      run('git', ['diff', '--quiet', 'origin/main', 'origin/develop']);
      return;
    } catch (error) {
      if (error.status !== 1) throw error;
    }
    const messages = run('git', ['log', 'origin/main..origin/develop', '--format=%B']);
    references.push(messages);
    const numbers = new Set([...messages.matchAll(/\(#(\d+)\)/g)].map((match) => match[1]));
    for (const pr of numbers)
      references.push(
        JSON.parse(readGH('pr', 'view', pr, '--repo', repository, '--json', 'body')).body || '',
      );
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'release-pr-'));
  try {
    const file = path.join(temporary, 'body.md');
    const closing = extractClosingReferences(references)
      .map((reference) => `Closes ${reference}`)
      .join('\n');
    fs.writeFileSync(
      file,
      `Promote ${head} into ${base}.\n\nMerge requires Verify gate and Validate base branch on the current head SHA.\n${release ? 'Friday 15:00 Beijing time (UTC+8) release train.\n\nThe merge commit preserves conventional commits and BREAKING CHANGE notes from develop.' : `Both registries verified version ${receipt.version}. Source run: ${receipt.runId}.`}\n\n${closing}\n`,
    );
    if (number) {
      gh('pr', 'edit', String(number), '--repo', repository, '--body-file', file);
    } else {
      const url = gh(
        'pr',
        'create',
        '--repo',
        repository,
        '--base',
        base,
        '--head',
        head,
        '--title',
        release
          ? 'chore(release): promote develop to main'
          : `chore(repo): sync release ${receipt.version} to develop`,
        '--body-file',
        file,
      );
      number = Number(url.split('/').pop());
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  if (receipt) {
    receipt.syncAuthorizationRunId = process.env.GITHUB_RUN_ID;
    receipt.syncAuthorizationSHA = process.env.GITHUB_SHA;
    receipt.syncPR = number;
    artifact.save(receipt);
  }
  console.log(`PR #${number}; merge is handled after required CI completes`);
}
function merge(number, sha, authorization) {
  if (!/^\d+$/.test(number) || !/^[a-f0-9]{40}$/.test(sha))
    throw new Error('Explicit PR and head SHA required');
  const pr = JSON.parse(
    readGH(
      'pr',
      'view',
      number,
      '--repo',
      repository,
      '--json',
      'baseRefName,headRefName,headRefOid,isCrossRepository,mergeable,statusCheckRollup',
    ),
  );
  if (!(
    (pr.baseRefName === 'main' && pr.headRefName === 'develop') ||
    (pr.baseRefName === 'develop' && pr.headRefName === 'main')
  ))
    throw new Error('Not a release or sync PR');
  if (pr.baseRefName === 'develop')
    validateSyncAuthorization(
      authorization?.receipt,
      authorization?.run || {},
      repository,
      Number(number),
      sha,
    );
  const checks = pr.statusCheckRollup || [];
  if (
    !requiredChecks.every((name) =>
      checks.some(
        (check) =>
          check.name === name && check.status === 'COMPLETED' && check.conclusion === 'SUCCESS',
      ),
    )
  ) {
    console.log('Required checks are pending; a later CI completion will retry the verified merge');
    return false;
  }
  validatePullRequest(pr, sha, requiredChecks);
  gh('pr', 'merge', number, '--repo', repository, '--auto', '--merge', '--match-head-commit', sha);
}
module.exports = { create, merge };
if (require.main === module) {
  const [command, ...args] = process.argv.slice(2);
  Promise.resolve()
    .then(() => (command === 'merge' ? merge(...args) : create(command)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
