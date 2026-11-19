# Cloud agents

How a Linux machine in the cloud gets a working checkout, and which domains and variables it needs. Local machines follow [running the app locally](local-app.md).

A Linux machine (Ubuntu 24.04, as root or with passwordless sudo) gets everything from `bash scripts/cloud/setup.sh`: Node.js and pnpm from `.tool-versions`, PostgreSQL 18 from apt.postgresql.org as a service on port 5432, the dependencies, Playwright's Chromium and `pnpm db:setup`. It's safe to rerun. Snapshots and restarts keep files but not processes, so a new session runs `bash scripts/cloud/start.sh`, which starts PostgreSQL, installs changed dependencies and applies new migrations. Node.js goes to `/opt/node<major>` and is linked from `/usr/local/bin`; a shell whose `PATH` finds another Node.js first needs `/opt/node<major>/bin` at its front.

- Claude Code cloud: set the environment's setup script to `bash scripts/cloud/setup.sh`. The repository's SessionStart hook runs `start.sh` when `CLAUDE_CODE_REMOTE` is `true` and puts that Node.js first on the session's `PATH`; its log is `/tmp/zoonk-start.log`. Hooks don't run in sessions with several repositories or in a project's threads, so run `start.sh` there yourself.
- Codex cloud: environments live only in Codex's settings. Set the setup script to `bash scripts/cloud/setup.sh` and the maintenance script to `bash scripts/cloud/start.sh`; if PostgreSQL isn't answering during a task, run `start.sh`.
- boat.dev or any Ubuntu 24.04 machine: run `bash scripts/cloud/setup.sh` once; systemd starts PostgreSQL after a reboot. After pulling, run `pnpm install && pnpm db:setup`.

Allow these domains beyond each platform's defaults, which already cover nodejs.org, the npm registry, GitHub and Ubuntu's mirrors:

- Setup: `apt.postgresql.org` (PostgreSQL) and `cdn.playwright.dev` (Chromium). Codex's setup runs with full internet access; on Claude Code choose Custom network access, list them and keep the default list.
- The agent: `ai-gateway.vercel.sh`, for anything that generates.

Set variables in the platform's environment variables, which commands read like any others. None is required; each turns on one thing:

- `AI_GATEWAY_API_KEY`: everything that generates, such as plans, lessons, grading and speech. Use the team's development key, which has a monthly budget. On Codex it can be a network secret for `ai-gateway.vercel.sh` instead, so the machine never holds it: commands see a placeholder, the AI SDK sends that as its bearer token, and Codex's proxy swaps in the key. Leaving the variable unset doesn't work there, since the SDK then looks for a Vercel OIDC token and fails before sending anything.
- `OPENAI_API_KEY`: live language calls (GPT-Live) only.
- Vercel Blob (uploads, generated pictures and audio) signs in through a linked Vercel project, so it needs a Vercel login ([AI Gateway and Blob](local-app.md#ai-gateway-and-blob)); agents usually run without it.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` for checkout, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google sign-in, and the `APPLE_*` keys for Apple sign-in and App Store purchases, each only for that flow. Sign-in codes go to the local mailbox without a mailer key.
