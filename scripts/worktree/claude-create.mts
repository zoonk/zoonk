import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { z } from "zod";
import { run } from "./postgres.mts";

/**
 * Claude Code's WorktreeCreate hook replaces its own `git worktree add`, and Claude Code has no hook that runs after its own creation.
 * Creating the worktree here lets every Claude Code worktree get the same setup as Codex and T3 Code before Claude enters it.
 * Claude Code reads the last stdout line as the worktree path, so setup output goes to stderr.
 */
const input = z
  .object({ cwd: z.string(), name: z.string() })
  .parse(JSON.parse(await text(process.stdin)));

const root = await run({ args: ["rev-parse", "--show-toplevel"], command: "git", cwd: input.cwd });
const worktree = join(root, ".claude", "worktrees", input.name);

/**
 * Claude Code passes the main checkout as `cwd`, so new branches start from the session checkout's commit, as T3 Code and Codex worktrees do.
 * Claude Code never deletes the branch of a worktree a hook created, so reusing a name resumes that branch instead of failing.
 */
async function addWorktree(): Promise<void> {
  const branch = `worktree-${input.name}`;

  const [existingBranch, base] = await Promise.all([
    run({ args: ["branch", "--list", branch], command: "git", cwd: root }),
    run({
      args: ["rev-parse", "HEAD"],
      command: "git",
      cwd: process.env.CLAUDE_PROJECT_DIR ?? input.cwd,
    }),
  ]);

  await run({
    args: existingBranch
      ? ["worktree", "add", worktree, branch]
      : ["worktree", "add", "-b", branch, worktree, base],
    command: "git",
    cwd: root,
  });
}

/** Runs the new checkout's own setup, as Codex and T3 Code do, so a branch's setup changes apply to its worktrees. */
function setupWorktree(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(worktree, "scripts/worktree/setup.mts")], {
      cwd: worktree,
      stdio: ["ignore", process.stderr, process.stderr],
    });

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Worktree setup failed with exit code ${code}.`));
    });
  });
}

if (!existsSync(worktree)) {
  await addWorktree();
}

await setupWorktree();
process.stdout.write(`${worktree}\n`);
