import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { join } from "node:path";

export const LOCAL_DATABASE_NAMES = { dev: "zoonk", e2e: "zoonk_e2e", test: "zoonk_test" } as const;

export type DatabaseMode = keyof typeof LOCAL_DATABASE_NAMES;

const WORKTREE_ID_LENGTH = 12;

export function isLinkedWorktree(checkout: string): boolean {
  return statSync(join(checkout, ".git"), { throwIfNoEntry: false })?.isFile() ?? false;
}

/** Every database a worktree owns starts with this, its test runs' copies included. */
export function worktreeDatabasePrefix(worktree: string): string {
  const identifier = createHash("sha256")
    .update(worktree)
    .digest("hex")
    .slice(0, WORKTREE_ID_LENGTH);

  return `zoonk_wt_${identifier}_`;
}

export function worktreeDatabaseName({
  mode,
  worktree,
}: {
  mode: DatabaseMode;
  worktree: string;
}): string {
  return `${worktreeDatabasePrefix(worktree)}${mode}`;
}
