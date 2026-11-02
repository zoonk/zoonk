import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyEnvironment } from "./environment.mts";

function checkout(root: string, name: string): string {
  const path = join(root, name);
  mkdirSync(join(path, "apps", "main"), { recursive: true });
  mkdirSync(join(path, "packages"), { recursive: true });
  return path;
}

describe(copyEnvironment, () => {
  it("gives a worktree the primary checkout's Vercel link and keeps the worktree's own files", () => {
    const root = mkdtempSync(join(tmpdir(), "zoonk-environment-"));
    const primary = checkout(root, "primary");
    const worktree = checkout(root, "worktree");
    const link = JSON.stringify({ orgId: "team_test", projectId: "prj_test" });

    mkdirSync(join(primary, "apps/main/.vercel"));
    writeFileSync(join(primary, "apps/main/.vercel/project.json"), link);
    writeFileSync(join(primary, "apps/main/.env"), "BLOB_STORE_ID=store_primary\n");
    writeFileSync(join(worktree, "apps/main/.env"), "BLOB_STORE_ID=store_worktree\n");

    copyEnvironment({ primary, worktree });

    expect(readFileSync(join(worktree, "apps/main/.vercel/project.json"), "utf8")).toBe(link);

    expect(readFileSync(join(worktree, "apps/main/.env"), "utf8")).toBe(
      "BLOB_STORE_ID=store_worktree\n",
    );
  });
});
