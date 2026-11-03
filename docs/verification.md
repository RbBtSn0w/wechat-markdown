# Implementation and acceptance status

Local implementation verified on 2026-11-02. This record covers local validation;
remote rules updates, credential configuration, and package publication remain
outside that validation. The working version remains 1.7.0; the next promotion
requires a major release as described in the migration guide.

## Audit closure

| Finding                            | Implemented protection                                                           | Regression evidence                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Runtime mismatch                   | Node 22.14 floor, Node 22 types, aligned CI and compatible release tooling       | Three isolated clean installs and full verification matrices                              |
| Vulnerable production dependencies | Patched sanitization, redirects, and undici; removed deepmerge chain             | Production audit exits 0 with zero vulnerabilities                                        |
| Environment-dependent tests        | Explicit test discovery and original in-repository article corpus                | Default suite excludes hidden worktrees and does not require a neighboring checkout       |
| URL mutation after sanitization    | Validate base configuration and resolve before sanitization; compare URL origins | Invalid bases, malformed body links, same-origin and prefix-confusion cases               |
| Global image substitution          | Decode attributes and update individual image nodes in document order            | Duplicate sources, text/link isolation, attribute escaping, alt and failure behavior      |
| Release event and recovery gaps    | Trusted App writes, required checks, exact SHA and artifact authorization        | Partial publication, reruns, mismatches, fork provenance, and last-completing target gate |
| Invalid YAML output types          | Plain metadata mapping and validated string fields                               | Non-mapping roots, wrong field types, malformed YAML and fallback diagnostics             |
| Markdown syntax boundary loss      | Per-render tokens for math and Mermaid                                           | Code, escaped delimiters, nested/commented HTML, fences and safe degradation              |

## Executed checks

| Environment                 | Typecheck | Zero-warning lint | Tests      | Build  | Formatting | Packed consumer |
| --------------------------- | --------- | ----------------- | ---------- | ------ | ---------- | --------------- |
| Node 22.14.0, clean install | Passed    | Passed            | 119 passed | Passed | Passed     | Passed          |
| Node 22.22.2, workspace     | Passed    | Passed            | 119 passed | Passed | Passed     | Passed          |
| Node 24.22.2, clean install | Passed    | Passed            | 119 passed | Passed | Passed     | Passed          |

Each consumer check installed the actual tarball and production dependencies
in a temporary project, checked CommonJS loading and exported declarations,
and rendered an article without access to repository sources. Clean installs
used `npm ci --no-audit --no-fund`; auditing was executed separately.

The final production audit reported zero vulnerabilities. The repository's
mandatory formatting check and the expanded formatting script passed. Workflow
YAML was parsed with duplicate keys rejected. The rules renderer was exercised
locally with an example App ID; it did not call GitHub.

The original mixed-article fixture was rendered with the previous HEAD source
and the updated source using the same installed dependencies and injected media
services. All three built-in themes retained the same DOM structure, attributes,
article title, digest and media/footnote counts after normalizing insignificant
HTML whitespace. Serialized HTML differs in whitespace.

New behavior regressions were observed failing before implementation, including
the independently discovered malformed-link, escaped-delimiter, HTML-comment,
recovery-provenance and synchronization-authorization cases. The last-finishing
branch gate regression exercises the actual workflow subscription and handler
with an external CLI fake; tests never publish or mutate remote state.

## Review fixes

The five follow-up findings were repaired without discarding the existing change
set. New behavior tests failed for the expected reasons before implementation.

- Release metadata commits use the exact `[release-metadata]` subject instead of
  a global skip-CI directive. A separate read-only job verifies the App identity,
  commit ancestry, message and version-only changes before skipping stable
  publication. PR verification remains enabled on the original metadata SHA.
- Block math interrupts adjacent paragraphs without requiring blank lines,
  including quotes and lists.
- Inline Markdown is re-lexed in document order with a shared HTML parser scope.
  Both block and inline tags suppress formulas inside HTML while preserving
  emphasis, code, images and formulas after the closing tag. The HTML parser
  was already a production dependency transitively and is now declared directly.
- Void tags no longer cause repeated scans of the remaining source. The local
  6,000-`<br>` example improved from approximately 1.78 seconds to 0.14 seconds
  with math enabled. This measurement is evidence, not a machine-dependent test
  threshold; a long-void-sequence regression protects content and formula scope.
- Invalid root-relative article URLs lose their `href` rather than aborting the
  engine or the directly invoked inliner; invalid `siteUrl` still throws.

Independent review also exercised reference links, tables, quotes, nested lists,
task lists and image alt values. Both reported block-HTML scope regressions have
explicit regression coverage. The final boundary suite has 32 cases, and the
complete suite has 119 cases across 10 files. Minimum Node 22.14 and Node 24
clean installs were rechecked after these fixes; current Node 22 was checked in
the workspace. No remote release or rules activation was performed.

## Remote acceptance still pending

The local checks do not establish that GitHub rules, App credentials, npm OIDC,
registry access, or workflow events operate remotely. Follow
[the release runbook](release-train.md) to configure the existing App and
activate the reviewed rules, then observe the first normal release and sync PR.
No artificial release or remote fault injection is required.

Registry/sync recovery reuses the original failed run's saved package and checks
its trusted provenance. A later failure creating the GitHub Release display
record requires separate repair of that record; recovery does not recompute a
version or rewrite tags. Expired evidence or different content under an existing
version blocks recovery.

## PR #57 review remediation

- Aligned `format` with the complete `format:check` scope and excluded release-sync PRs from preview publication.
- Reproduced immediate post-publish E404 failure, then added bounded metadata propagation polling (six inspections, ten seconds apart). Pre-publish absence remains single-shot; authentication and content mismatches fail closed.
- Replaced the fixed main sync head with a dedicated release-bound branch. Local Git graph tests cover develop advancement, repeated refreshes, untouched main, ordinary injected commits, forged merge trees, and conflicts. Trusted develop CI completion refreshes authorized candidates; new heads require fresh checks. Strict trunk rules remain unchanged.
- Independently reviewed the authorization changes and reproduced/fixed a batch isolation issue: an unauthorized same-prefix PR must not prevent a later authorized sync candidate from refreshing.
- Node 22.22.2: 126 tests across 11 files pass; source/test types, zero-warning lint, production audit (zero vulnerabilities), build, required/expanded formatting, and packed consumer verification pass. Audit required network access; consumer verification used an isolated temporary npm cache. No remote rules, production publishing, or real release sync was activated or claimed.
