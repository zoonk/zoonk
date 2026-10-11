# Deployments

GitHub Actions owns deployments of `api`, `main`, and `admin`. Their Vercel projects keep the Git connection for fetching the exact commit, but `git.deploymentEnabled: false` prevents automatic deployments. The database-independent blog keeps its existing Vercel Git deployments.

This configuration takes effect on a branch when its app-level `vercel.json` files are pushed. The PR workflow can run before it reaches `main`; a branch push without an open PR does not create these previews. Merging the configuration into `main` runs CI and deploys staging, without creating a production release or deployment.

| Event                           | Checks and deployment                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| PR opened, updated, or reopened | Fast code-quality checks for PRs targeting `main`. Relevant same-repository PRs get a Neon branch and Vercel previews.                     |
| PR closed                       | Cancel remaining preview builds and delete the PR's Neon branch.                                                                           |
| Push to `main`                  | Code quality, unit/integration tests, and main/API E2E. After success, migrate staging and deploy the three staging apps.                  |
| Push a `v*` tag                 | Run CI if the exact commit has not already passed CI on `main`. This supports hotfix commits outside `main`.                               |
| Publish a stable GitHub release | Require successful CI for the tagged commit, migrate production once, and deploy all three production apps concurrently on Turbo machines. |
| Publish a prerelease            | No production deployment.                                                                                                                  |

Production domains move automatically when each deployment succeeds. Apps switch independently, so a failed release can leave a successful app on the new version while another remains on the old version. Production releases are serialized with GitHub's `queue: max`; up to 100 runs can wait without replacing one another.

## Configuration contract

Provider tokens live in GitHub repository secrets. Non-secret resource identifiers and deployment selectors live in repository variables. The workflows read these values:

| Setting                                                                      | Storage            | Purpose                                                           |
| ---------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| `VERCEL_TOKEN`                                                               | Secret             | Access to the three Vercel projects.                              |
| `VERCEL_ORG_ID`                                                              | Variable           | Team owning those projects.                                       |
| `VERCEL_PROJECT_ID_API`, `VERCEL_PROJECT_ID_MAIN`, `VERCEL_PROJECT_ID_ADMIN` | Variables          | App-to-project mapping.                                           |
| `NEON_API_KEY`                                                               | Secret             | Neon branch management and connection strings.                    |
| `NEON_PROJECT_ID`                                                            | Variable           | Neon project selected by the GitHub integration.                  |
| `NEON_PRODUCTION_BRANCH`                                                     | Optional variable  | Production branch name or ID; defaults to `production`.           |
| `NEON_STAGING_BRANCH`                                                        | Optional variable  | Staging branch name or ID; defaults to `staging`.                 |
| `NEON_DATABASE`, `NEON_ROLE`                                                 | Optional variables | Explicit selection when a branch has multiple databases or roles. |
| `TURBO_TOKEN`, `TURBO_TEAM`                                                  | Secret, variable   | Turborepo remote cache for CI.                                    |

The workflow resolves the two existing Neon branches and refuses to proceed if either is missing or both resolve to the same branch. The pinned Neon CLI retrieves pooled and direct connection strings and automatically selects a database/role when the branch has only one of each. Ambiguous selection fails instead of choosing arbitrarily. Connection strings are masked and kept within the deployment job.

PR branches are children of staging, named `preview/pr-<number>`, and are reused on subsequent commits. The official Neon create-branch action receives the database/role resolved from the staging parent. PR database credentials are passed to migrations and deployments within the same job.

Each Vercel project has a custom environment named `staging` and its own domain:

| App   | Staging           | Production        |
| ----- | ----------------- | ----------------- |
| API   | `api.zoonk.dev`   | `api.zoonk.com`   |
| Main  | `main.zoonk.dev`  | `www.zoonk.com`   |
| Admin | `admin.zoonk.dev` | `admin.zoonk.com` |

App settings and service credentials are scoped to the deployment environment. The three apps share their non-production authentication secret and database; production uses its separate credentials. App/API URLs are supplied explicitly for staging and production.

### Protected API requests

Preview and staging use Vercel Standard Protection and Trusted Sources rules allowing main/admin to call the API in the same environment. Server requests attach their short-lived OIDC token in `x-vercel-trusted-oidc-idp-token`. Zoonk's own user authentication and authorization still apply.

Main's browser API calls use its same-origin `/v1` proxy when Vercel's built-in `NEXT_PUBLIC_VERCEL_ENV` is `preview`. Custom environments, including staging, also report `preview`; `NEXT_PUBLIC_VERCEL_TARGET_ENV` identifies their custom name. Vercel supplies these variables automatically with system environment variables exposed. The proxy preserves paths, queries, bodies, streams, and application bearer headers while adding platform authentication on the server. It removes ambient browser cookies and rejects unsafe requests from other origins. `/v1/auth` is excluded; central login and provider callbacks remain on the API host.

Production and local development retain direct API requests and omit these OIDC headers.

The default build machine is Basic; production selects Turbo per deployment. On-demand concurrency is a Vercel project setting and applies across its environments. Production deployment requests are submitted concurrently; their actual build start times depend on available build capacity.

The main branch ruleset requires the fast `code-quality` PR check. E2E and database test jobs run after merge.

## Preview behavior

Changes under `apps/api`, `apps/main`, `apps/admin`, `packages`, or shared dependency/deployment configuration deploy all three database-connected apps. This includes runtime dependencies that a build graph cannot detect. Blog-only changes do not create a database branch or these previews.

The API deploys first. Its actual deployment URL is passed to main/admin as `NEXT_PUBLIC_API_URL` at build time and runtime. All three receive the same PR database URLs. The API preview uses its own Vercel hostname for self-references. Preview URLs appear in the Actions job summary.

New commits cancel the previous Actions run and its queued/building Vercel deployments. Cancellation cleanup is scoped to that run, so it cannot cancel a newer run. Every preview submission and readiness poll verifies that its PR is still open and its commit is still current. Fork PRs run fast checks without deployment secrets and do not receive database previews.

## Releases and hotfixes

For the regular release, choose a commit that passed CI on `main`, create a `v*` tag on it, and publish a stable GitHub release. The tag workflow reuses successful CI for that exact commit. Publishing the release is the production deployment trigger; the weekly cadence is determined by when releases are published.

For a patch, branch from the last successfully deployed release tag, apply the fix, and push a new patch `v*` tag. CI runs for that commit, even when it is outside `main`. Publish its stable GitHub release; the release workflow waits for that commit's CI to succeed. Bring the fix back to `main` through a PR, using a cherry-pick when merging the hotfix branch would reintroduce unrelated release history. Hotfix branches must include this deployment automation; tags predating its introduction need the automation brought forward first.

App builds generate Prisma but never migrate a database. Each deployment workflow migrates once before starting the builds. Migrations must support the previously deployed apps while the new builds run and switch domains. Hotfix migrations must not depend on unreleased migrations from `main`.

## Local verification

Run `mise x -- pnpm test:deploy` for deployment orchestration tests and `mise x -- pnpm --filter @zoonk/utils test src/url.test.ts src/origin.test.ts` for API URL/origin behavior. Tests intercept the provider HTTP calls and Neon CLI execution; they never deploy or migrate a live database.

Local tests exercise orchestration at the provider boundaries. They do not verify live credentials, remote builds, migration permissions, or Vercel-protected cross-project requests.
