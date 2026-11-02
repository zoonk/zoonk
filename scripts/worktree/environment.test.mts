import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ownDevelopmentDatabaseUrl, worktreeDatabaseName } from "./environment.mts";

const checkouts: string[] = [];

function checkout(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "zoonk-environment-")));
  checkouts.push(root);
  mkdirSync(join(root, "packages/db"), { recursive: true });
  return root;
}

function writeDatabaseUrl({ url, worktree }: { url: string; worktree: string }): string {
  writeFileSync(join(worktree, "packages/db/.env"), `DATABASE_URL_UNPOOLED=${url}\n`);
  return worktree;
}

afterEach(() => {
  for (const root of checkouts.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe(ownDevelopmentDatabaseUrl, () => {
  it("returns the URL of the worktree's own development copy", () => {
    const worktree = checkout();
    const name = worktreeDatabaseName({ mode: "dev", worktree });
    const url = `postgres://postgres:postgres@localhost:5432/${name}?connect_timeout=30`;

    expect(ownDevelopmentDatabaseUrl(writeDatabaseUrl({ url, worktree }))).toBe(url);
  });

  it("ignores the primary checkout's database, another worktree's copy and other servers", () => {
    const worktree = checkout();
    const own = worktreeDatabaseName({ mode: "dev", worktree });
    const other = worktreeDatabaseName({ mode: "dev", worktree: "/elsewhere" });

    const urls = [
      "postgres://postgres:postgres@localhost:5432/zoonk",
      `postgres://postgres:postgres@localhost:5432/${other}`,
      `postgres://postgres:postgres@db.example.com:5432/${own}`,
      `postgres://postgres:postgres@localhost:5432/${own}?host=db.example.com`,
    ];

    expect(
      urls.map((url) => ownDevelopmentDatabaseUrl(writeDatabaseUrl({ url, worktree }))),
    ).toStrictEqual([null, null, null, null]);
  });

  it("ignores a checkout without a database environment", () => {
    expect(ownDevelopmentDatabaseUrl(checkout())).toBeNull();
  });
});
