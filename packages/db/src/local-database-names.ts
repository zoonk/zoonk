import { createHash } from "node:crypto";

export const LOCAL_DATABASE_NAMES = { dev: "zoonk", e2e: "zoonk_e2e", test: "zoonk_test" } as const;

export type DatabaseMode = keyof typeof LOCAL_DATABASE_NAMES;

const WORKTREE_ID_LENGTH = 12;

export function worktreeDatabaseName({
  mode,
  worktree,
}: {
  mode: DatabaseMode;
  worktree: string;
}): string {
  const identifier = createHash("sha256")
    .update(worktree)
    .digest("hex")
    .slice(0, WORKTREE_ID_LENGTH);

  return `zoonk_wt_${identifier}_${mode}`;
}
