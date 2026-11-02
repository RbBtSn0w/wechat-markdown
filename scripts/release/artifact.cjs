const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { publishRegistries, validateRecovery } = require('./control.cjs');
const registries = { npm: 'https://registry.npmjs.org', github: 'https://npm.pkg.github.com' };
const output = path.resolve('release-artifact');
const execute = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
    ...options,
  });

function manifest(tarball, run = execute) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'release-content-'));
  try {
    const names = run('tar', ['-tzf', tarball]).trim().split('\n').filter(Boolean);
    if (
      names.some(
        (name) =>
          !name.startsWith('package/') || name.split('/').includes('..') || name.startsWith('/'),
      )
    )
      throw new Error('Unsafe package entry');
    // Extract only ordinary files; links and special entries are rejected before extraction.
    const listing = run('tar', ['-tvzf', tarball]).trim().split('\n');
    if (listing.some((line) => !['-', 'd'].includes(line[0])))
      throw new Error('Unsafe package entry type');
    run('tar', ['-xzf', tarball, '-C', temporary]);
    const result = {};
    for (const name of names.sort()) {
      const entry = path.join(temporary, name);
      if (fs.statSync(entry).isFile())
        result[name] = crypto.createHash('sha256').update(fs.readFileSync(entry)).digest('hex');
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(temporary, 'package/package.json'), 'utf8'));
    return { files: result, name: pkg.name, version: pkg.version };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function registryAdapter(receipt, directory = output, run = execute) {
  return {
    async inspect(key) {
      const registry = registries[key];
      try {
        run('npm', [
          'view',
          `${receipt.name}@${receipt.version}`,
          'dist.integrity',
          '--registry',
          registry,
          '--json',
        ]);
      } catch (error) {
        // Only a registry E404 is absence. Authentication, networking and rate limits fail closed.
        const detail = String(error.stderr || error.message);
        if (/\bE404\b/.test(detail)) return null;
        throw error;
      }
      const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'release-registry-'));
      try {
        const packed = JSON.parse(
          run('npm', [
            'pack',
            `${receipt.name}@${receipt.version}`,
            '--registry',
            registry,
            '--ignore-scripts',
            '--json',
            '--pack-destination',
            temporary,
          ]),
        );
        const downloaded = path.join(temporary, path.basename(packed[0].filename));
        const actual = manifest(downloaded, run);
        if (actual.name !== receipt.name || actual.version !== receipt.version)
          throw new Error(`${key} package identity mismatch`);
        return actual.files;
      } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
      }
    },
    async publish(key) {
      const args = [
        'publish',
        path.join(directory, receipt.tarball),
        '--registry',
        registries[key],
        '--tag',
        receipt.channel || 'latest',
        '--access',
        'public',
        '--ignore-scripts',
      ];
      if (key === 'npm') args.push('--provenance');
      run('npm', args);
    },
  };
}
function save(receipt, directory = output) {
  fs.writeFileSync(path.join(directory, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
}
function load(directory = output) {
  return JSON.parse(fs.readFileSync(path.join(directory, 'receipt.json'), 'utf8'));
}
function prepare(version, channel = 'latest') {
  fs.mkdirSync(output, { recursive: true });
  const packed = JSON.parse(
    execute('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output]),
  );
  const tarball = path.basename(packed[0].filename);
  const content = manifest(path.join(output, tarball));
  if (content.version !== version) throw new Error('Packed version mismatch');
  const receipt = {
    schema: 1,
    name: content.name,
    version,
    channel,
    runId: process.env.GITHUB_RUN_ID,
    sourceSHA: process.env.GITHUB_SHA,
    releaseSHA: execute('git', ['rev-parse', 'HEAD']).trim(),
    tarball,
    sha512: crypto
      .createHash('sha512')
      .update(fs.readFileSync(path.join(output, tarball)))
      .digest('hex'),
    manifest: content.files,
    registries: {},
    syncPR: null,
  };
  save(receipt);
  return receipt;
}
async function publish(directory = output) {
  const receipt = load(directory);
  if (path.basename(receipt.tarball) !== receipt.tarball) throw new Error('Unsafe artifact path');
  if (!process.env.GITHUB_TOKEN) throw new Error('Missing GITHUB_TOKEN for GitHub Packages');
  const content = manifest(path.join(directory, path.basename(receipt.tarball)));
  const digest = crypto
    .createHash('sha512')
    .update(fs.readFileSync(path.join(directory, path.basename(receipt.tarball))))
    .digest('hex');
  if (
    digest !== receipt.sha512 ||
    content.name !== receipt.name ||
    content.version !== receipt.version ||
    !require('node:util').isDeepStrictEqual(content.files, receipt.manifest)
  )
    throw new Error('Artifact content or integrity mismatch');
  await publishRegistries(receipt, registryAdapter(receipt, directory), (state) =>
    save(state, directory),
  );
  return receipt;
}
async function recover(runId, version) {
  if (!/^\d+$/.test(runId || '') || !/^\d+\.\d+\.\d+$/.test(version || ''))
    throw new Error('Explicit failed run and stable version required');
  const receipt = load();
  const run = JSON.parse(
    execute('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`]),
  );
  const workflow = JSON.parse(
    execute('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/release.yml`]),
  );
  if (run.workflow_id !== workflow.id) throw new Error('Recovery workflow identity mismatch');
  validateRecovery(receipt, run, process.env.GITHUB_REPOSITORY, version);
  return publish();
}
module.exports = { manifest, registryAdapter, prepare, publish, recover, load, save };
if (require.main === module) {
  const [command, ...args] = process.argv.slice(2);
  Promise.resolve()
    .then(() => {
      if (command === 'preview') return prepare(args[0], 'next');
      if (command === 'publish') return publish();
      if (command === 'recover') return recover(...args);
      throw new Error('Unknown release artifact command');
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
