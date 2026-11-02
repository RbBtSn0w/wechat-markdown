const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const artifact = require('./artifact.cjs');
const { validateMetadata } = require('./control.cjs');
const { metadataMessage } = require('./metadata.cjs');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
exports.verifyConditions = async () => {
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Stable releases require main');
  if (!process.env.RELEASE_BOT_TOKEN || !process.env.GITHUB_TOKEN)
    throw new Error('Missing release credentials');
};
exports.prepare = async (_config, context) => {
  const paths = git('diff', '--name-only', 'HEAD').split('\n').filter(Boolean);
  for (const name of paths) {
    const before = name === 'CHANGELOG.md' ? null : JSON.parse(git('show', `HEAD:${name}`));
    const after = name === 'CHANGELOG.md' ? null : JSON.parse(fs.readFileSync(name, 'utf8'));
    validateMetadata(name, before, after);
  }
  const plugin = await import('@semantic-release/git');
  // Only the metadata commit uses the App installation token. Other APIs retain GITHUB_TOKEN.
  const repositoryUrl = `https://x-access-token:${process.env.RELEASE_BOT_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
  await plugin.prepare(
    {
      assets: ['package.json', 'package-lock.json', 'CHANGELOG.md'],
      message: metadataMessage(context.nextRelease.version),
    },
    { ...context, options: { ...context.options, repositoryUrl } },
  );
  artifact.prepare(context.nextRelease.version);
};
exports.publish = async () => {
  const receipt = await artifact.publish();
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `released=true\nversion=${receipt.version}\n`);
  return { name: `npm and GitHub Packages ${receipt.version}` };
};
