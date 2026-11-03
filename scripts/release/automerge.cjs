const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { merge } = require('./pr.cjs');
const { validateSyncAuthorization } = require('./control.cjs');
const event = JSON.parse(fs.readFileSync(process.env.EVENT_PATH, 'utf8'));
const repository = process.env.GITHUB_REPOSITORY;
// Reads use the ordinary job token; only the final CI-triggering merge uses the App token.
const read = (...args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN },
  });
function syncAuthorization(number, branch) {
  const workflow = JSON.parse(read('api', `repos/${repository}/actions/workflows/release.yml`));
  const runs = JSON.parse(
    read(
      'api',
      `repos/${repository}/actions/workflows/release.yml/runs?branch=main&status=success&per_page=100`,
    ),
  ).workflow_runs;
  for (const run of runs) {
    if (
      run.workflow_id !== workflow.id ||
      !['push', 'workflow_dispatch'].includes(run.event) ||
      run.head_repository?.full_name !== repository
    )
      continue;
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-authorization-'));
    try {
      try {
        read(
          'run',
          'download',
          String(run.id),
          '--repo',
          repository,
          '--name',
          'release-complete',
          '--dir',
          temporary,
        );
      } catch {
        continue;
      }
      const receipt = JSON.parse(fs.readFileSync(path.join(temporary, 'receipt.json'), 'utf8'));
      try {
        validateSyncAuthorization(receipt, run, repository, number, branch);
      } catch {
        continue;
      }
      return { receipt, run };
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  throw Object.assign(
    new Error('No successful trusted release artifact authorizes this sync PR and branch'),
    { code: 'SYNC_AUTHORIZATION_MISSING' },
  );
}
function onReleaseCompletion(run) {
  const workflow = JSON.parse(read('api', `repos/${repository}/actions/workflows/release.yml`));
  if (
    run.workflow_id !== workflow.id ||
    !['push', 'workflow_dispatch'].includes(run.event) ||
    run.head_repository?.full_name !== repository ||
    run.head_branch !== 'main'
  )
    throw new Error('Untrusted release completion');
  const artifacts = JSON.parse(
    read('api', `repos/${repository}/actions/runs/${run.id}/artifacts`),
  ).artifacts;
  if (!artifacts.some((entry) => entry.name === 'release-complete' && !entry.expired)) return;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-authorization-'));
  try {
    read(
      'run',
      'download',
      String(run.id),
      '--repo',
      repository,
      '--name',
      'release-complete',
      '--dir',
      temporary,
    );
    const receipt = JSON.parse(fs.readFileSync(path.join(temporary, 'receipt.json'), 'utf8'));
    if (!receipt.syncPR) return;
    validateSyncAuthorization(receipt, run, repository, receipt.syncPR, receipt.syncBranch);
    const pr = JSON.parse(
      read('pr', 'view', String(receipt.syncPR), '--repo', repository, '--json', 'headRefOid'),
    );
    merge(String(receipt.syncPR), pr.headRefOid, { receipt, run });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
if (event.workflow_run.name === 'Release') {
  onReleaseCompletion(event.workflow_run);
} else {
  const refresh =
    event.workflow_run.event === 'push' && event.workflow_run.head_branch === 'develop';
  const candidates = refresh
    ? JSON.parse(
        read(
          'pr',
          'list',
          '--repo',
          repository,
          '--base',
          'develop',
          '--state',
          'open',
          '--limit',
          '100',
          '--json',
          'number,headRefName,headRefOid,isCrossRepository',
        ),
      )
        .filter((pr) => !pr.isCrossRepository && pr.headRefName.startsWith('release-sync/'))
        .map((pr) => ({
          number: pr.number,
          head: { ref: pr.headRefName, sha: pr.headRefOid, repo: { id: repository } },
          base: { ref: 'develop', repo: { id: repository } },
        }))
    : event.workflow_run.pull_requests;
  for (const candidate of candidates) {
    if (!(
      (candidate.base.ref === 'main' && candidate.head.ref === 'develop') ||
      (candidate.base.ref === 'develop' && candidate.head.ref.startsWith('release-sync/'))
    ))
      continue;
    if (candidate.head.repo.id !== candidate.base.repo.id) continue;
    const sha = candidate.head.sha;
    const recorded = JSON.parse(
      read('api', `repos/${repository}/actions/runs/${event.workflow_run.id}`),
    );
    if (!refresh && recorded.head_sha !== sha) throw new Error('Workflow head provenance changed');
    try {
      const authorization =
        candidate.base.ref === 'develop'
          ? syncAuthorization(candidate.number, candidate.head.ref)
          : undefined;
      merge(String(candidate.number), sha, authorization);
    } catch (error) {
      if (!refresh) throw error;
      console.error(`Sync PR #${candidate.number}: ${error.message}`);
      if (error.code !== 'SYNC_AUTHORIZATION_MISSING') process.exitCode = 1;
    }
  }
}
