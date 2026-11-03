import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  copyEnvironment,
  ownDevelopmentDatabaseUrl,
  worktreeDatabaseName,
  writeEnvironment,
} from "./environment.mts";

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

const databaseCheckouts: string[] = [];

function databaseCheckout(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "zoonk-environment-")));
  databaseCheckouts.push(root);
  mkdirSync(join(root, "packages/db"), { recursive: true });
  return root;
}

function writeDatabaseUrl({ url, worktree }: { url: string; worktree: string }): string {
  writeFileSync(join(worktree, "packages/db/.env"), `DATABASE_URL_UNPOOLED=${url}\n`);
  return worktree;
}

afterEach(() => {
  for (const root of databaseCheckouts.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe(ownDevelopmentDatabaseUrl, () => {
  it("returns the URL of the worktree's own development copy", () => {
    const worktree = databaseCheckout();
    const name = worktreeDatabaseName({ mode: "dev", worktree });
    const url = `postgres://postgres:postgres@localhost:5432/${name}?connect_timeout=30`;

    expect(ownDevelopmentDatabaseUrl(writeDatabaseUrl({ url, worktree }))).toBe(url);
  });

  it("ignores the primary checkout's database, another worktree's copy and other servers", () => {
    const worktree = databaseCheckout();
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
    expect(ownDevelopmentDatabaseUrl(databaseCheckout())).toBeNull();
  });
});

function app({
  dependencies,
  name,
  worktree,
}: {
  dependencies: object;
  name: string;
  worktree: string;
}): string {
  const directory = join(worktree, "apps", name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "package.json"), JSON.stringify({ dependencies }));
  return join(directory, ".env");
}

function readUrl(path: string): string | undefined {
  return existsSync(path) ? parseEnv(readFileSync(path, "utf8")).DATABASE_URL : undefined;
}

describe(writeEnvironment, () => {
  it("points an app that reads the database at the worktree's copy even when it has no .env", () => {
    const worktree = databaseCheckout();
    const reader = app({ dependencies: { "@zoonk/db": "workspace:*" }, name: "main", worktree });
    const other = app({ dependencies: {}, name: "blog", worktree });
    const name = worktreeDatabaseName({ mode: "dev", worktree });

    writeEnvironment({
      source: new URL("postgres://postgres:postgres@localhost:5432/zoonk"),
      worktree,
    });

    expect(readUrl(reader)).toBe(`postgres://postgres:postgres@localhost:5432/${name}`);
    expect(existsSync(other)).toBe(false);
  });
});
