// Render reviewable payloads only. This command never calls the GitHub API.
const appId = Number(process.argv[2]);
if (!Number.isSafeInteger(appId) || appId <= 0)
  throw new Error('Provide the installed rbbtsn0w-bot App ID to render payloads');
const branchRules = (branch) => ({
  name: `release-train-${branch}`,
  target: 'branch',
  enforcement: 'active',
  bypass_actors:
    branch === 'main'
      ? [{ actor_id: appId, actor_type: 'Integration', bypass_mode: 'always' }]
      : [],
  conditions: { ref_name: { include: [`refs/heads/${branch}`], exclude: [] } },
  rules: [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    {
      type: 'pull_request',
      parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: true,
        allowed_merge_methods: branch === 'main' ? ['merge'] : ['merge', 'squash', 'rebase'],
      },
    },
    {
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: true,
        do_not_enforce_on_create: false,
        required_status_checks: [{ context: 'Verify gate' }, { context: 'Validate base branch' }],
      },
    },
  ],
});
console.log(
  JSON.stringify({ main: branchRules('main'), develop: branchRules('develop') }, null, 2),
);
