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
function syncAuthorization(number, sha) {
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
        validateSyncAuthorization(receipt, run, repository, number, sha);
      } catch {
        continue;
      }
      return { receipt, run };
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  throw new Error('No successful trusted release artifact authorizes this sync PR and head SHA');
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
    validateSyncAuthorization(receipt, run, repository, receipt.syncPR, receipt.releaseSHA);
    merge(String(receipt.syncPR), receipt.releaseSHA, { receipt, run });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
if (event.workflow_run.name === 'Release') {
  onReleaseCompletion(event.workflow_run);
} else {
  for (const candidate of event.workflow_run.pull_requests) {
    if (!(
      (candidate.base.ref === 'main' && candidate.head.ref === 'develop') ||
      (candidate.base.ref === 'develop' && candidate.head.ref === 'main')
    ))
      continue;
    if (candidate.head.repo.id !== candidate.base.repo.id) continue;
    const sha = candidate.head.sha;
    const recorded = JSON.parse(
      read('api', `repos/${repository}/actions/runs/${event.workflow_run.id}`),
    );
    if (recorded.head_sha !== sha) throw new Error('Workflow head provenance changed');
    const authorization =
      candidate.base.ref === 'develop' ? syncAuthorization(candidate.number, sha) : undefined;
    merge(String(candidate.number), sha, authorization);
  }
}
