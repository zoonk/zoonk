import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseEnv } from "node:util";
import {
  getLocalDatabaseUrl,
  getUnpooledDatabaseUrl,
  isLocalDevelopmentDatabase,
} from "../../packages/db/src/local-database.ts";
import { getTestEnvironment } from "../../packages/db/src/test-environment.ts";

const ENV_FILES = [".env", ".env.local", ".env.development.local", ".env.production.local"];
/** The app's Vercel link, which the Blob SDK reads to fetch the project's OIDC token. */
const VERCEL_LINK = join(".vercel", "project.json");
const ID_LENGTH = 12;
const DATABASE_ENVIRONMENT = join("packages", "db", ".env");

export type DatabaseMode = "dev" | "test" | "e2e";

export function worktreeDatabaseName({
  mode,
  worktree,
}: {
  mode: DatabaseMode;
  worktree: string;
}): string {
  const identifier = createHash("sha256").update(worktree).digest("hex").slice(0, ID_LENGTH);
  return `zoonk_wt_${identifier}_${mode}`;
}

function readEnvironment(path: string): NodeJS.Dict<string> {
  return existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
}

export function ownDevelopmentDatabaseUrl(worktree: string): string | null {
  const url = readEnvironment(join(worktree, DATABASE_ENVIRONMENT)).DATABASE_URL_UNPOOLED;
  const name = worktreeDatabaseName({ mode: "dev", worktree });

  return url && isLocalDevelopmentDatabase(url) && new URL(url).pathname === `/${name}`
    ? url
    : null;
}

function environmentPaths(root: string, files = ENV_FILES): string[] {
  return ["apps", "packages"].flatMap((group) =>
    readdirSync(join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => files.map((file) => join(group, entry.name, file))),
  );
}

/** Existing worktree secrets and developer overrides survive a setup rerun. */
export function copyEnvironment({
  primary,
  worktree,
}: {
  primary: string;
  worktree: string;
}): void {
  for (const relative of environmentPaths(worktree, [...ENV_FILES, VERCEL_LINK])) {
    const source = join(primary, relative);
    const destination = join(worktree, relative);

    if (existsSync(source) && !existsSync(destination)) {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, readFileSync(source), { mode: 0o600 });
    }
  }
}

/** The databases the checkout's configuration names, which in a worktree are its own copies once `writeEnvironment` ran. */
export function checkoutDatabaseUrls(worktree: string): Record<DatabaseMode, URL> {
  return {
    dev: new URL(getUnpooledDatabaseUrl(readEnvironment(join(worktree, DATABASE_ENVIRONMENT)))),
    e2e: new URL(getTestEnvironment("e2e").DATABASE_URL_UNPOOLED),
    test: new URL(getTestEnvironment("test").DATABASE_URL_UNPOOLED),
  };
}

export function localSource(primary: string): URL | null {
  const source = new URL(
    getUnpooledDatabaseUrl(readEnvironment(join(primary, DATABASE_ENVIRONMENT))),
  );

  if (
    !["postgres:", "postgresql:"].includes(source.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)
  ) {
    return null;
  }

  source.pathname = new URL(getLocalDatabaseUrl()).pathname;
  source.search = "";
  return source;
}

function databaseEnvironment({ name, source }: { name: string; source: URL }): {
  DATABASE_URL: string;
  DATABASE_URL_UNPOOLED: string;
} {
  const url = new URL(source);
  url.pathname = `/${name}`;
  return { DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href };
}

function readsDatabase(directory: string): boolean {
  const path = join(directory, "package.json");
  const manifest: unknown = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;

  const dependencies =
    manifest && typeof manifest === "object" && "dependencies" in manifest
      ? manifest.dependencies
      : null;

  return Boolean(dependencies && typeof dependencies === "object" && "@zoonk/db" in dependencies);
}

/** Next.js reads only its own app's `.env`, and an app without a URL would use the primary checkout's `zoonk`. */
function databaseEnvironmentPaths(root: string): string[] {
  const apps = readdirSync(join(root, "apps"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && readsDatabase(join(root, "apps", entry.name)))
    .map((entry) => join("apps", entry.name, ".env"));

  return [DATABASE_ENVIRONMENT, ...apps];
}

/** Publish isolated URLs before provisioning so a failed setup cannot silently use the shared databases. */
export function writeEnvironment({ source, worktree }: { source: URL; worktree: string }): void {
  const dev = databaseEnvironment({
    name: worktreeDatabaseName({ mode: "dev", worktree }),
    source,
  });

  const required = new Set(databaseEnvironmentPaths(worktree));
  const paths = new Set([...environmentPaths(worktree), ...required]);

  paths.forEach((relative) => {
    const path = join(worktree, relative);
    const content = existsSync(path) ? readFileSync(path, "utf8") : "";

    if (
      !required.has(relative) &&
      !/^[\t ]*(?:export[\t ]+)?DATABASE_URL(?:_UNPOOLED)?[\t ]*=/mu.test(content)
    ) {
      return;
    }

    const otherVariables = content.replaceAll(
      /^[\t ]*(?:export[\t ]+)?DATABASE_URL(?:_UNPOOLED)?[\t ]*=.*\r?\n?/gmu,
      "",
    );

    const lines = [
      otherVariables.trimEnd(),
      `DATABASE_URL=${dev.DATABASE_URL}`,
      `DATABASE_URL_UNPOOLED=${dev.DATABASE_URL_UNPOOLED}`,
    ].filter(Boolean);

    writeFileSync(path, `${lines.join("\n")}\n`, { mode: 0o600 });
  });

  for (const mode of ["test", "e2e"] as const) {
    const environment = databaseEnvironment({
      name: worktreeDatabaseName({ mode, worktree }),
      source,
    });

    writeFileSync(
      join(worktree, `packages/db/.env.${mode}.local`),
      `DATABASE_URL=${environment.DATABASE_URL}\nDATABASE_URL_UNPOOLED=${environment.DATABASE_URL_UNPOOLED}\n`,
      { mode: 0o600 },
    );
  }
}
