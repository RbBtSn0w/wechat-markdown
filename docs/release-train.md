# Branching and release

`main` is the only integration trunk. Create short-lived feature/fix branches from
current `origin/main`; submit reviewed squash PRs to `main`. Keep Conventional
Commit titles and breaking-change footers. PR metadata and the actual engine-selected
release range use the same conventionalcommits parser, using the default analyzer rules.
No commit SHA exemptions are permitted.

## Publication

`.github/workflows/release.yml` runs Friday at 07:00 UTC (15:00 Asia/Singapore)
and by manual dispatch on main. Both jobs require `RELEASE_ENABLED == 'true'`;
unset disables publication. CI and PRs never publish. develop beta, PR previews,
promotion PRs, sync-back and Dependabot retarget writers have been removed.

The read-only job installs locked dependencies, verifies the candidate, builds once,
packs once with scripts disabled, runs publint and exercises the installed packed
API/CLI. An immutable same-run artifact ID carries the candidate SHA and SHA256 checksum.
The publisher restores those exact bytes and checks live main immediately before
semantic-release. Any read error, empty result or drift fails closed.

semantic-release alone selects the version and creates the tag/notes. Its stateless
payload hook updates only the restored package manifest version and archives the
same files without build, pack or lifecycle scripts. npmjs and GitHub Packages
receive the identical final archive. Existing versions require matching SHA512
integrity; registry/auth failures are errors. Each successful target writes a receipt.
The GitHub Release attaches the archive, identity and registry receipts.
The release job never writes version/changelog commits to main.

## Activation and recovery

This migration is default-off, not evidence of operational publication. Before enablement,
verify npm trusted-publisher binding to this repository and exact workflow filename
`release.yml`, supported Node/npm OIDC, package/tag permissions and real release baseline/history. Configure PR squash title/body
and required checks separately. Do not change credentials as a fallback on failure.

Publication across registries, GitHub is not transactional. Download this
run's final archive/identity and target receipts after partial failure; verify candidate,
version and archive digest, then explicitly recover only the missing side effect.
A later semantic-release no-op does not repair a missing mirror/Release entry.
Never republish different bytes at an existing version or rewrite tags. External old
controllers/timers must be disabled at the separately authorized cutover. Remote develop
is retained inactive; branch deletion is a separate owner action.

## Local checks

```bash
npm ci --no-audit --no-fund
npm run build
npm test
npm pack --ignore-scripts --pack-destination /absolute/scratch
npm run test:package -- /absolute/scratch/package.tgz
node --test test/release-payload.test.mjs
```

## Migration blocker: historical commit semantics

**Publication must remain disabled.** Existing unreleased history contains invalid
Conventional Commit messages under strict release-range lint. No SHA exemptions,
skip-release exemptions, baseline invention, or history rewriting is allowed. The
owning upstream compatibility decision must close this blocker before activation.
A squash PR title does not make inherited release-range history valid.

The accepted develop tip `7d2592d63798bed77a990d7323c0c65bce728507`
contains `feat!` rendering/runtime/typing changes. The migration PR's squash message
must preserve the breaking declaration so the next intended release is v2. Follow
`docs/migration-v2.md`; do not downgrade this work to a patch.

A local semantic-release dry-run against a temporary mirror of real history/tags/notes
(no service plugins or credentials) selected `v1.7.0` and rejected commit
`80ed9177bf7d6162e6308bd436db71895edb7846` with empty Conventional Commit type/subject. This is
expected fail-closed evidence, not a successful release or an activation waiver.
