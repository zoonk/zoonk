import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

const ENV_FILES = [".env", ".env.local", ".env.development.local", ".env.production.local"];
const ID_LENGTH = 12;

export function worktreeDatabaseName({
  mode,
  worktree,
}: {
  mode: "dev" | "test" | "e2e";
  worktree: string;
}): string {
  const identifier = createHash("sha256").update(worktree).digest("hex").slice(0, ID_LENGTH);
  return `zoonk_wt_${identifier}_${mode}`;
}

function environmentPaths(root: string): string[] {
  return ["apps", "packages"].flatMap((group) =>
    readdirSync(join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => ENV_FILES.map((file) => join(group, entry.name, file))),
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
  for (const relative of environmentPaths(worktree)) {
    const source = join(primary, relative);
    const destination = join(worktree, relative);

    if (existsSync(source) && !existsSync(destination)) {
      writeFileSync(destination, readFileSync(source), { mode: 0o600 });
    }
  }
}

export function localSource(primary: string): URL | null {
  const path = join(primary, "packages/db/.env");
  const environment = existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};

  const source = new URL(
    environment.DATABASE_URL_UNPOOLED ||
      environment.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/zoonk",
  );

  if (
    !["postgres:", "postgresql:"].includes(source.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)
  ) {
    return null;
  }

  source.pathname = "/zoonk";
  source.search = "";
  return source;
}

export function databaseEnvironment({ name, source }: { name: string; source: URL }): {
  DATABASE_URL: string;
  DATABASE_URL_UNPOOLED: string;
} {
  const url = new URL(source);
  url.pathname = `/${name}`;
  return { DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href };
}

/** Publish isolated URLs before provisioning so a failed setup cannot silently use the shared databases. */
export function writeEnvironment({ source, worktree }: { source: URL; worktree: string }): void {
  const dev = databaseEnvironment({
    name: worktreeDatabaseName({ mode: "dev", worktree }),
    source,
  });

  const databasePath = join("packages", "db", ".env");
  const paths = new Set([...environmentPaths(worktree), databasePath]);

  paths.forEach((relative) => {
    const path = join(worktree, relative);
    const content = existsSync(path) ? readFileSync(path, "utf8") : "";

    if (
      relative !== databasePath &&
      !/^[\t ]*(?:export[\t ]+)?DATABASE_URL(?:_UNPOOLED)?[\t ]*=/mu.test(content)
    ) {
      return;
    }

    const otherVariables = content.replaceAll(
      /^[\t ]*(?:export[\t ]+)?DATABASE_URL(?:_UNPOOLED)?[\t ]*=.*\r?\n?/gmu,
      "",
    );

    writeFileSync(
      path,
      `${otherVariables.trimEnd()}\nDATABASE_URL=${dev.DATABASE_URL}\nDATABASE_URL_UNPOOLED=${dev.DATABASE_URL_UNPOOLED}\n`,
      { mode: 0o600 },
    );
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
