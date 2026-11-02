import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { z } from "zod";
import { run } from "./postgres.mts";

/**
 * Claude Code's WorktreeCreate hook replaces its own `git worktree add` and has no post-create hook,
 * so the worktree is created and set up here. Claude Code reads the last stdout line as the path, so
 * setup output goes to stderr.
 */
const input = z
  .object({ cwd: z.string(), name: z.string() })
  .parse(JSON.parse(await text(process.stdin)));

const root = await run({ args: ["rev-parse", "--show-toplevel"], command: "git", cwd: input.cwd });
const worktree = join(root, ".claude", "worktrees", input.name);

/**
 * Claude Code passes the main checkout as `cwd` and never deletes a hook-created branch, so reusing
 * a name resumes that branch.
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
