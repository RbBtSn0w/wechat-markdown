const { execFileSync } = require('node:child_process');
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const syncBranch = (releaseSHA) => {
  if (!/^[a-f0-9]{40}$/.test(releaseSHA || '')) throw new Error('Invalid release SHA');
  return `release-sync/${releaseSHA}`;
};
function isAncestor(before, after, run) {
  try {
    run('merge-base', '--is-ancestor', before, after);
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}
function verifySyncHead(releaseSHA, headSHA, developSHA, run = git) {
  for (const sha of [releaseSHA, headSHA, developSHA])
    if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Invalid sync SHA');
  let current = headSHA;
  for (let count = 0; current !== releaseSHA; count += 1) {
    if (count >= 1000) throw new Error('Excessive sync history');
    const [tree, ...parents] = run('show', '-s', '--format=%T %P', current).split(' ');
    if (parents.length !== 2 || !isAncestor(parents[1], developSHA, run))
      throw new Error('Unauthorized sync commit');
    const expected = run('merge-tree', '--write-tree', parents[0], parents[1]);
    if (tree !== expected) throw new Error('Unauthorized sync merge tree');
    current = parents[0];
  }
  return isAncestor(developSHA, headSHA, run);
}
// Only trusted workflows call this with an authenticated API wrapper. No PR code is checked out.
function refreshSyncBranch(receipt, api, run = git) {
  const branch = syncBranch(receipt.releaseSHA);
  if (receipt.syncBranch !== branch) throw new Error('Unauthorized sync branch');
  const head = api(`git/ref/heads/${branch}`).object.sha;
  const develop = api('git/ref/heads/develop').object.sha;
  run('fetch', '--no-tags', 'origin', receipt.releaseSHA, head, develop);
  if (verifySyncHead(receipt.releaseSHA, head, develop, run)) return { sha: head, updated: false };
  if (isAncestor(receipt.releaseSHA, develop, run))
    return { sha: head, updated: false, alreadySynced: true };
  // Preflight detects conflicts before any remote mutation.
  run('merge-tree', '--write-tree', head, develop);
  const merged = api('merges', {
    base: branch,
    head: develop,
    commit_message: 'chore(repo): refresh verified release sync',
  });
  const sha = merged?.sha || api(`git/ref/heads/${branch}`).object.sha;
  run('fetch', '--no-tags', 'origin', sha);
  if (!verifySyncHead(receipt.releaseSHA, sha, develop, run))
    throw new Error('Sync did not include develop');
  return { sha, updated: true };
}
module.exports = { syncBranch, verifySyncHead, refreshSyncBranch };
