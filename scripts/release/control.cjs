const { isDeepStrictEqual } = require('node:util');
const { syncBranch } = require('./sync.cjs');

async function publishRegistries(receipt, adapter, save = () => {}) {
  const failures = [];
  let verified = 0;
  for (const registry of ['npm', 'github']) {
    try {
      let actual = await adapter.inspect(registry);
      if (actual === null) {
        await adapter.publish(registry);
        actual = await adapter.inspect(registry, { attempts: 6 });
      }
      if (actual === null) throw new Error(`${registry} verification failed: artifact absent`);
      if (!isDeepStrictEqual(actual, receipt.manifest))
        throw new Error(`${registry} content mismatch`);
      verified += 1;
      receipt.registries[registry] = 'verified';
      save(receipt);
    } catch (error) {
      receipt.registries[registry] = { failed: error.message };
      save(receipt);
      if (/content mismatch|identity mismatch/.test(error.message)) throw error;
      failures.push(error);
    }
  }
  if (failures.length && (receipt.channel !== 'next' || verified === 0)) throw failures[0];
  return receipt;
}

function validateRecovery(receipt, run, repository, version) {
  if (run.conclusion !== 'failure') throw new Error('Recovery requires an explicitly failed run');
  if (receipt.version !== version) throw new Error('Recovery version mismatch');
  if (
    !['push', 'workflow_dispatch'].includes(run.event) ||
    run.head_repository?.full_name !== repository ||
    receipt.schema !== 1 ||
    String(run.id) !== receipt.runId ||
    run.head_branch !== 'main' ||
    run.head_sha !== receipt.sourceSHA ||
    run.path !== '.github/workflows/release.yml' ||
    run.repository.full_name !== repository
  )
    throw new Error('Recovery provenance mismatch');
}

function validateMetadata(path, before, after) {
  if (path === 'CHANGELOG.md') return;
  if (!['package.json', 'package-lock.json'].includes(path))
    throw new Error(`Forbidden metadata path: ${path}`);
  const stripVersion = (value) => {
    const copy = structuredClone(value);
    delete copy.version;
    if (path === 'package-lock.json' && copy.packages?.['']) delete copy.packages[''].version;
    return copy;
  };
  if (!isDeepStrictEqual(stripVersion(before), stripVersion(after)))
    throw new Error(`Non-version metadata change: ${path}`);
}

function validatePullRequest(pr, expectedSHA, requiredChecks) {
  if (pr.isCrossRepository) throw new Error('Cross repository promotion forbidden');
  if (pr.headRefOid !== expectedSHA) throw new Error('PR head changed');
  if (pr.mergeable !== 'MERGEABLE') throw new Error('PR conflict or unknown mergeability');
  const passing = new Set(
    pr.statusCheckRollup
      .filter((check) => check.status === 'COMPLETED' && check.conclusion === 'SUCCESS')
      .map((check) => check.name),
  );
  if (!requiredChecks.every((name) => passing.has(name)))
    throw new Error('Required checks have not passed');
}

function validateSyncAuthorization(receipt, run, repository, number, branch) {
  if (
    !receipt ||
    receipt.syncPR !== number ||
    receipt.syncBranch !== branch ||
    receipt.syncBranch !== syncBranch(receipt.releaseSHA) ||
    receipt.syncAuthorizationRunId !== String(run.id) ||
    receipt.syncAuthorizationSHA !== run.head_sha ||
    run.conclusion !== 'success' ||
    run.head_branch !== 'main' ||
    run.path !== '.github/workflows/release.yml' ||
    !['push', 'workflow_dispatch'].includes(run.event) ||
    run.repository?.full_name !== repository ||
    run.head_repository?.full_name !== repository ||
    !['npm', 'github'].every((key) => receipt.registries[key] === 'verified')
  )
    throw new Error('Missing or stale verified sync authorization');
}

function extractClosingReferences(texts) {
  const numbers = new Set();
  for (const text of texts) {
    for (const match of text.matchAll(
      /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*#\d+(?:[ \t,]+#\d+)*/gi,
    )) {
      for (const reference of match[0].matchAll(/#(\d+)/g)) numbers.add(Number(reference[1]));
    }
  }
  return [...numbers].sort((a, b) => a - b).map((number) => `#${number}`);
}

module.exports = {
  publishRegistries,
  validateRecovery,
  validateMetadata,
  validatePullRequest,
  extractClosingReferences,
  validateSyncAuthorization,
};
