# Sharing one machine

Agents working in parallel share the machine's memory, disk and devices. Read this before a heavy command, before booting a device, and before you hand back.

## Heavy jobs take turns

- Builds, test suites and E2E runs go through `pnpm dev:queue`, one per 20 GB of the machine's memory (`ZOONK_QUEUE_SLOTS` overrides it), so parallel agents don't push the machine into swap. `pnpm start`'s build, `pnpm build`, `pnpm test`, the E2E builds and runs, the device launchers' builds (`pnpm iphone`, `pnpm android:phone`) and the Apple and Android Makefiles already queue. Prefix other heavy commands, such as `pnpm dev:queue pnpm --filter @zoonk/core test`, and run `pnpm dev:queue` alone before booting a simulator or emulator, so the boot waits while every slot is busy. A job started inside a queued job runs at once, and CI skips the queue.
- The [Apple](../../apps/apple/AGENTS.md#simulators) and [Android](../../apps/android/AGENTS.md#emulators-and-builds) guidance caps how many simulators, emulators and native builds run at once. On macOS, a lead whose lanes use them runs `pnpm dev:close-device-crash-alerts` each time it checks on them, so crash alerts don't pile up on screen.
- Keep local builds, test runs and simulators to what the change needs, and stop a server when you're done with it: an idle dev stack holds about 8 GB, a production one about 2.5 GB.

## When the machine is busy, run on GitHub

Push the branch and use its PR checks. To run a full suite on GitHub, use `gh workflow run ci.yml --ref <branch>` (code quality, Vitest and both E2E suites) or `gh workflow run android.yml --ref <branch>` (adds the release lint and build). Apple PRs check only formatting, so run the Apple checks locally; the Mac unit tests run after merge, and the tests that need an iPhone only when you run them ([Apple verification](../../apps/apple/AGENTS.md#verification)). Follow them with `gh run list --branch <branch>`. Several branches can run at once. `measure-pages.yml` times pages on a runner of its own (`gh workflow run measure-pages.yml -f paths="/today /plan" -f base=main`), and `preview.yml` deploys a pull request's Vercel preview.

Turbo shares task results through Vercel Remote Cache, so typecheck, lint and test runs replay what CI or another checkout already ran for unchanged packages. Link a machine once with `pnpm exec turbo login` and `pnpm exec turbo link` (it needs access to Zoonk's Vercel team); runs then print "Remote caching enabled". Only builds hash the database URL, which differs between CI, the primary checkout and each worktree.

## Worktrees, branches and handing back

Every worktree fills the disk with its own builds and database copies; its dependencies cost little, since pnpm clones them from its store.

- Each `pnpm worktree:setup` starts a sweep in the background (`pnpm worktree:sweep` runs one now, `--dry-run` lists what it would delete, `~/.cache/zoonk/sweep.log` records each run). It deletes build output (Xcode, Next.js and Gradle builds, and `node_modules` outside worktrees) that nothing touched for 12 hours and no process runs inside: in other worktrees, in `/tmp` and in `~/zoonk-review`, where a lead keeps its notes, reports and evidence so they survive a reboot and the lanes' worktrees. It also drops Swift packages no build used for a week and the wallpaper snapshots that pile up on shut-down simulators, and shuts down Android emulators nobody tapped or opened an app on for two hours, since an idle one can keep a CPU core busy. Notes, reports, screenshots and source files stay.

- Before an agent hands back, it commits its work (its branch keeps the commits) and stops the servers it started.
- The agent that owns the task's PR pushes and keeps its worktree, since review fixes and the user's follow-up changes happen there; the harness removes it once the PR merges.
- A subagent or lane removes the worktree made for its slice. It reports first, since a session running inside the worktree loses its turn when the worktree goes; then, as its last command, it runs `git worktree remove <path>` from outside it, which refuses while uncommitted work is left. The next `pnpm worktree:setup` drops a removed worktree's database copies.
- A lead lands a lane's commits from its branch and doesn't need the lane's checkout. It removes the worktree of a lane that failed, was cancelled or handed back uncommitted work, once its commits are landed or dropped. Reviews and other read-only tasks run in the lead's checkout, without a worktree.
- A remote branch is deleted the moment it's no longer used: a trial branch once it lands or is abandoned, a lane's branch once its last commit is on the task's branch, and a branch you replace when you replace it.
- Task notes, status files, reports, briefs and handoffs stay outside the repository and never go in a commit.
