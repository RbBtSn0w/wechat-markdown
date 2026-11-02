# Release train setup and recovery

This change is local preparation. It does not configure credentials, activate GitHub rules, publish packages, or prove remote operation. The observed live rules previously protected only deletion and non-fast-forward updates; they did not enforce PRs or CI. Do not treat those rules as the target state.

## Event sequence

1. Friday at 15:00 Beijing time (UTC+8), the trusted default-branch workflow creates or reuses the same-repository `develop -> main` PR with the `rbbtsn0w-bot` installation token. Merge commits preserve conventional commits and `BREAKING CHANGE` messages for semantic-release, including a major release.
2. CI runs on the PR. The trusted default-branch `workflow_run` handler verifies `Verify gate` and `Validate base branch`, same-repository branch identity, mergeability, and the exact head SHA before requesting auto-merge. There is no direct-merge fallback.
3. The resulting main push runs semantic-release on Node 24. Its analyzer and notes generator determine the version; the npm prepare plugin updates package versions with lifecycle scripts disabled. The custom plugin validates that metadata changes affect only `package.json` version, lockfile top-level/root-package versions, and `CHANGELOG.md`, then delegates the metadata commit to `@semantic-release/git` using the App token. The commit includes `package-lock.json` and the dedicated `[release-metadata]` marker; it contains no global CI-skip directive. A read-only classifier skips only the recursive stable job for an exact `rbbtsn0w-bot[bot]` App push whose single-parent commit message and actual version-only metadata diff validate. Matching text on a code/dependency change or another sender does not suppress stable processing. CI and target-branch checks remain enabled on the original metadata SHA for the sync PR. Manual main recovery is never classified as a metadata push.
4. One saved tarball is verified or published to npm and GitHub Packages. npm uses OIDC provenance; GitHub Packages uses `GITHUB_TOKEN`. Every registry is downloaded and its actual file content compared to the saved manifest before success. Authentication/network errors fail closed. Existing versions are never overwritten.
5. Only successful dual-registry publication enables a reusable sync workflow, which creates or reuses a `main -> develop` PR using the App. It never pushes develop. That PR follows the same CI and SHA-bound auto-merge gate. The merger also requires a successful trusted Release run artifact containing matching sync PR number, exact release SHA, and verified outcomes for both registries; a manually created sync PR has no such authority. Conflicts stop automation for human resolution through a normal PR.

Stable runs share a non-cancelling concurrency group. Manual stable/recovery runs are main-only. A semantic-release no-op produces no release marker, package evidence, or sync request.

## External activation gates

These are owner setup tasks, not actions performed by this change:

- Install/configure the existing `rbbtsn0w-bot` App for this repository with Contents and Pull requests write permissions. Set repository variable `RBBTSN0W_BOT_APP_ID` and secret `RBBTSN0W_BOT_PRIVATE_KEY`. Neither value was configured at implementation time. Do not substitute a PAT. The App is used only for automatic PRs/merges that must trigger subsequent CI and protected-main metadata commits. PR previews never receive it.
- Make `main` the trusted default branch. Protect `.github/workflows/`, `scripts/release/`, and release configuration through review. Enable repository auto-merge and merge commits. PR preview code receives only the ordinary scoped job token and OIDC; same-repository contributors must already be trusted to publish prereleases.
- Configure npm trusted publishers for this repository's `release.yml` and `ci.yml` workflows and package `@rbbtsn0w/wechat-markdown`; verify GitHub Packages Actions write access. No `NPM_TOKEN` is used.
- Render payloads with `node scripts/release/rules.cjs APP_ID > /tmp/release-rules.json`. Review the two payloads, then have the owner apply each through GitHub ruleset management. The renderer makes no API calls. Enforce PRs, thread resolution, strict required checks `Verify gate` and `Validate base branch`, deletion protection, and non-fast-forward protection on both trunks.
- The `main` payload gives only the installed App an always bypass because a version metadata commit is not a PR. GitHub rules cannot restrict that bypass to file paths: the trusted plugin enforces the narrower metadata diff before using it. The same App can merge normal develop PRs only after develop rules pass; there is no develop bypass. Decide whether this residual App authority is acceptable before activation.
- Inspect the applied rules and required check names after activation. Observe the next ordinary release and its evidence rather than manufacturing remote test releases, fault injection, or rehearsals. Local tests do not prove OIDC, App permissions, rules enforcement, remote event delivery, or auto-merge behavior.

## Durable evidence

`release-evidence` is uploaded even after partial failure, retained 90 days. It contains the tarball and `receipt.json`: schema, exact version, source workflow run ID/source SHA, release metadata SHA, tarball SHA-512, per-file SHA-256 manifest, registry outcomes and sync PR. `release-complete` adds the sync PR outcome and authorizing run ID/SHA. Auto-merge searches the last 100 successful trusted Release runs. CI, PR Target Branch, and Release completion each trigger the trusted handler: if CI finishes first, Release completion checks the saved authorization and existing checks; if Release finishes first, CI completion checks the saved authorization. If the independent target-branch gate finishes last, PR Target Branch completion retries the same authorized SHA. Pending checks wait for the later event without polling. The tarball includes the public packed package files, including built CommonJS output. Expired/missing artifacts require investigation; never reconstruct a tarball from today's main and claim it is the original release.

The preview job uses Node 24 and a full-head-SHA prerelease version. It attempts both registries and fails when neither verifies; a content/identity mismatch always fails closed even if the other registry succeeds. A rerun accepts an existing version only after downloading and comparing the package files. Its `preview-PR-SHA` artifact records partial outcomes. A source change creates a distinct version; lifecycle scripts are disabled for install/version/pack/publish and semantic-release subprocesses.

## Recovery

Use **Release / Run workflow**, branch **main**, supplying both:

- `failed_run`: the original failed stable run ID that owns `release-evidence`.
- `version`: the exact stable version in that artifact.

The workflow downloads only that named artifact from the selected run. Before publication it checks the API run identity, failed conclusion, repository, main branch, workflow ID/path, allowed push/manual event, same-repository source and source SHA against the receipt; it verifies the saved tarball hash, package identity and all file hashes. Recovery never invokes semantic-release, computes a new version, rebuilds, or runs code from the artifact. It downloads each registry version again, accepts matching content, publishes only an absent version, and rejects different content. An E401/E403/network failure is not absence. Missing credentials stop recovery.

After both registries verify, recovery creates or reuses the sync PR. If the original failure was only sync creation/conflict, matching registry packages are left untouched. If a recovery run fails, continue selecting the original failed stable run and original version; its provenance remains authoritative. Existing sync conflicts require a normal developer PR to resolve, then rerun recovery. Sync also stops if main has advanced beyond the saved release SHA; it never authorizes unreleased newer main changes. Never force-push or directly update develop.

Recovery intentionally does not recreate a missing GitHub Release or rewrite tags after a later semantic-release GitHub-API failure; inspect and restore those release presentation records separately using the already verified version/tarball, without recomputing a version. This does not block registry or sync recovery.

If one registry already contains different bytes for the same version, stop. Do not overwrite, delete, or claim success. Investigate provenance and choose an explicitly approved new normal release after correcting the cause.

## Local verification

`npm test -- test/release-control.test.ts test/release-artifact.test.ts --testTimeout=15000` exercises partial failure/recovery, same-version reruns, changed source SHA, exact version/provenance, missing credentials, content mismatch, required checks and conflicts. Registry/CLI boundaries use injected fakes; archive manifests are checked using local tarballs. No test publishes, changes remote rules, or calls GitHub.
