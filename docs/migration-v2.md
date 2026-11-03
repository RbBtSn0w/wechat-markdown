# Next major release migration

This change set requires a major release. The working package version is not
manually advanced: semantic-release derives the next version from the promotion
history. The promotion must preserve a `BREAKING CHANGE:` declaration for the
runtime floor and metadata typing changes.

## Runtime

Node.js **22.14.0 or newer** is required. Node 20 is no longer supported because
the production CSS and sanitization dependencies already require Node 22.12 or
newer. Development type definitions target Node 22. The package continues to
export CommonJS and declaration files from `dist/`.

## Input validation

`siteUrl` must be an absolute HTTP(S) URL without credentials. Supplying an empty,
relative, credential-bearing, or non-HTTP URL throws `TypeError`, including when
calling the CSS inliner directly. Root-relative links use URL resolution, so a
base path does not become a prefix for `/article`.

Malformed article URLs do not invalidate an otherwise valid configuration. If a
root-relative link cannot be resolved, its navigation attribute is removed and
its text remains in the article.

Front-matter metadata is now `Record<string, unknown>`. Consumers must narrow
custom metadata fields before use. The root must be a plain mapping. Built-in
title and summary fields must be non-empty strings; invalid values generate
warnings and use normal fallbacks instead of violating `RenderResult` types.

## Rendering behavior

Image resolver callbacks receive decoded `src` and `alt` values in image order.
The returned value is escaped into the matching image's attribute; it cannot
rewrite matching text, links, or other nodes. Empty values and failed callbacks
retain the original image. `result.images` continues to describe sources before
resolution, and duplicate image occurrences remain distinct.

Math and Mermaid render only in eligible Markdown tokens. Dollar-delimited code
examples, escaped dollars, and raw HTML remain literal. Backtick and tilde Mermaid
fences are supported. Existing injected services, local generated files, data
URIs, and CDN URLs remain supported.

## Dependency changes

| Dependency       | Previous locked version | Updated version | Reason                                                                        |
| ---------------- | ----------------------- | --------------- | ----------------------------------------------------------------------------- |
| sanitize-html    | 2.18.0                  | 2.18.1          | Fix discarded-iframe recursion and remove the vulnerable deepmerge dependency |
| follow-redirects | 1.16.0                  | 1.16.2          | Fix cross-origin credential stripping                                         |
| undici           | 7.30.0                  | 7.30.1          | Fix the reported HTTP, TLS, and resource-exhaustion advisories                |
| cheerio          | 1.2.0 (transitive)      | 1.2.0 (direct)  | Declare the DOM API used by the SDK                                           |
| htmlparser2      | 12.0.0 (transitive)     | 12.0.0 (direct) | Share HTML scope across inline and block tokens without custom tag scanning   |

The existing xmldom, source-map-js, and ip-address overrides remain intentional
security floors for their dependency chains. The undici floor advances to the
patched version. Reassess these constraints when their owning dependencies
remove the need; do not remove them simply because an audit currently passes.

The Git release plugin uses the compatible 10.x line: 11.x requires a newer
runtime than the declared minimum even for development installs. Stable release
jobs still run on Node 24. Unused `@semantic-release/exec` and redundant
`@types/marked`, `@types/yaml`, and `@types/pako` packages are removed; these
libraries provide their own types.

## Verification and rollout

Default tests use the repository's original fixtures. External article scanning
is opt-in through `WECHAT_MARKDOWN_POSTS_DIR` and is supplementary evidence.
CI verifies the minimum runtime, current Node 22, and current Node 24; checks the
packed consumer; and audits production dependencies independently.

The local change set does not prove remote rules, OIDC publishing, App access,
or the first real release. Activate those only after the release runbook's
prerequisites are verified. Roll back source changes through a revert PR. Never
overwrite published package versions or rewrite release tags; ship a new version
for fixes to a published release.
