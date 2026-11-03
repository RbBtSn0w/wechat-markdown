const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { validateMetadata } = require('./control.cjs');
const bot = 'rbbtsn0w-bot[bot]';
function metadataMessage(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error('Stable metadata requires an exact version');
  return `chore(release): ${version} [release-metadata]`;
}
function isMetadataPush(event, commit, context) {
  if (
    context.eventName !== 'push' ||
    context.actor !== bot ||
    event.sender?.login !== bot ||
    event.sender?.type !== 'Bot' ||
    event.ref !== 'refs/heads/main' ||
    event.after !== commit.sha ||
    event.head_commit?.id !== commit.sha ||
    commit.parents.length !== 1 ||
    commit.parents[0] !== event.before ||
    event.head_commit.message.trim() !== commit.message
  )
    return false;
  const match = /^chore\(release\): (\d+\.\d+\.\d+) \[release-metadata\]$/.exec(commit.message);
  if (!match || !commit.changes.length) return false;
  const pkg = commit.changes.find((change) => change.path === 'package.json');
  if (!pkg || pkg.after?.version !== match[1] || pkg.before?.version === pkg.after.version)
    return false;
  try {
    for (const change of commit.changes) {
      if (change.afterMode && change.afterMode !== '100644') return false;
      if (change.beforeMode && change.beforeMode !== change.afterMode) return false;
      validateMetadata(change.path, change.before, change.after);
      if (
        change.path === 'package-lock.json' &&
        (change.after.version !== match[1] || change.after.packages?.['']?.version !== match[1])
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
function classify(event, context) {
  if (context.eventName !== 'push') return false;
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const sha = git('rev-parse', 'HEAD');
  const parents = git('show', '-s', '--format=%P', sha).split(' ').filter(Boolean);
  if (parents.length !== 1) return false;
  const paths = git('diff', '--name-only', '--no-renames', parents[0], sha)
    .split('\n')
    .filter(Boolean);
  if (paths.some((name) => !['package.json', 'package-lock.json', 'CHANGELOG.md'].includes(name)))
    return false;
  const changes = paths.map((name) => {
    const content = (ref) =>
      name === 'CHANGELOG.md' ? null : JSON.parse(git('show', `${ref}:${name}`));
    const mode = (ref) => git('ls-tree', ref, '--', name).split(' ')[0];
    return {
      path: name,
      before: content(parents[0]),
      after: content(sha),
      beforeMode: mode(parents[0]),
      afterMode: mode(sha),
    };
  });
  return isMetadataPush(
    event,
    { sha, parents, message: git('show', '-s', '--format=%B', sha), changes },
    context,
  );
}
module.exports = { metadataMessage, isMetadataPush, classify };
if (require.main === module) {
  let metadata = false;
  try {
    metadata = classify(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), {
      eventName: process.env.GITHUB_EVENT_NAME,
      actor: process.env.GITHUB_ACTOR,
    });
  } catch (error) {
    console.log(`Metadata classification rejected: ${error.message}`);
  }
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `metadata=${metadata}\n`);
}
