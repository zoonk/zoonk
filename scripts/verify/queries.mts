import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { type APIRequestContext, request } from "@playwright/test";
import { type Finding } from "./checks.mts";

/** As `ZOONK_QUERY_LOG` writes it (`packages/db/src/pool.ts`). */
export type Statement = { at: number; ms: number; rows: number | null; sql: string };

const REPEATED = 3;
const LARGE_RESULT = 1000;
const QUIET_MS = 1000;
const QUIET_LIMIT_MS = 15_000;
const QUIET_POLL_MS = 200;
const LABEL_LENGTH = 140;

export function readStatements(
  file: string,
  { from, to }: { from: number; to: number },
): Statement[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line))
    .filter(
      (entry): entry is Statement =>
        entry !== null && typeof entry === "object" && "at" in entry && "sql" in entry,
    )
    .filter((statement) => statement.at >= from && statement.at <= to);
}

async function waitForQuietDatabase(file: string) {
  const deadline = Date.now() + QUIET_LIMIT_MS;
  const last = { changedAt: Date.now(), size: -1 };

  while (Date.now() < deadline && Date.now() - last.changedAt < QUIET_MS) {
    const { size } = statSync(file);

    if (size !== last.size) {
      last.size = size;
      last.changedAt = Date.now();
    }

    // oxlint-disable-next-line no-await-in-loop -- Polls the log until it stops growing.
    await delay(QUIET_POLL_MS);
  }
}

export function label(sql: string): string {
  return sql
    .replaceAll('"public".', "")
    .replaceAll('"', "")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, LABEL_LENGTH);
}

const isRead = (sql: string) => /^\s*(?:SELECT|WITH)\b/iu.test(sql);

export function summarizeStatements(statements: Statement[]) {
  const counts = Map.groupBy(statements, (statement) => statement.sql);

  return {
    count: statements.length,
    dbMs: statements.reduce((total, statement) => total + statement.ms, 0),
    large: statements.filter((statement) => (statement.rows ?? 0) > LARGE_RESULT),
    reads: [...counts.keys()].filter((sql) => isRead(sql)),
    repeated: [...counts]
      .filter(([sql, same]) => isRead(sql) && same.length >= REPEATED)
      .map(([sql, same]) => ({ sql, times: same.length })),
  };
}

export function queryFindings(summary: ReturnType<typeof summarizeStatements>): Finding[] {
  return [
    ...summary.repeated.map(({ sql, times }): Finding => ({
      check: "repeated query",
      level: "warn",
      message: `ran ${times} times in one render (one read per item, or a fact not shared): ${label(sql)}`,
      unit: "times",
      value: times,
    })),
    ...summary.large.map(({ rows, sql }): Finding => ({
      check: "large result",
      level: "warn",
      message: `returned more than ${LARGE_RESULT} rows (unbounded, or more than the page shows): ${label(sql)}`,
      unit: "rows",
      value: rows ?? 0,
    })),
  ];
}

type PlanNode = {
  Filter?: string;
  "Node Type"?: string;
  Plans?: PlanNode[];
  "Relation Name"?: string;
};

export function filteredScans(node: PlanNode): { filter: string; table: string }[] {
  const own =
    node["Node Type"] === "Seq Scan" && node.Filter
      ? [{ filter: node.Filter, table: node["Relation Name"] ?? "?" }]
      : [];

  return [...own, ...(node.Plans ?? []).flatMap((child) => filteredScans(child))];
}

type Client = {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>;
};

/** Loaded the way Next.js loads it, with `pg` from the package that already depends on it. */
function connect(repository: string, production: boolean): Client {
  const main = createRequire(join(repository, "apps/main/package.json"));
  const next = createRequire(main.resolve("next/package.json"));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- @next/env's public API.
  const { loadEnvConfig } = next("@next/env") as {
    loadEnvConfig: (
      dir: string,
      dev: boolean,
    ) => { combinedEnv: Record<string, string | undefined> };
  };

  const { DATABASE_URL } = loadEnvConfig(join(repository, "apps/main"), !production).combinedEnv;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- pg's public Client API.
  const { Client } = createRequire(join(repository, "packages/db/package.json"))("pg") as {
    Client: new (options: { connectionString?: string }) => Client;
  };

  return new Client({ connectionString: DATABASE_URL });
}

/**
 * With sequential scans off, Postgres uses any index that can serve the query, so a sequential scan
 * that remains is a filter no index serves, even on a small local table.
 */
export async function findUnindexed(
  repository: string,
  { production, reads }: { production: boolean; reads: string[] },
): Promise<Finding[]> {
  if (reads.length === 0) {
    return [];
  }

  const client = connect(repository, production);
  await client.connect();
  const found = new Map<string, Finding>();

  try {
    for (const sql of reads) {
      // oxlint-disable-next-line no-await-in-loop -- One plan at a time on one connection.
      await client.query("BEGIN");

      try {
        // oxlint-disable-next-line no-await-in-loop -- Inside this read's transaction.
        await client.query("SET LOCAL enable_seqscan = off");
        // oxlint-disable-next-line no-await-in-loop -- Inside this read's transaction.
        const { rows } = await client.query(`EXPLAIN (GENERIC_PLAN, FORMAT JSON) ${sql}`);
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Postgres's JSON plan format.
        const [plan] = (rows[0]?.["QUERY PLAN"] ?? []) as { Plan: PlanNode }[];

        for (const { filter, table } of plan ? filteredScans(plan.Plan) : []) {
          found.set(`${table} ${filter}`, {
            check: "no index",
            level: "warn",
            message: `${table} is read through every row for ${filter}: add an index that serves it, or say why the table stays small`,
          });
        }
      } catch {
        // A statement Postgres can't plan generically is skipped; the others still count.
      } finally {
        // oxlint-disable-next-line no-await-in-loop -- Ends this read's transaction.
        await client.query("ROLLBACK");
      }
    }
  } finally {
    await client.end();
  }

  return [...found.values()];
}

type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

/**
 * An HTTP request, so no prefetches or browser requests mix in; background work after the response
 * counts.
 */
export async function measureRender({
  baseUrl,
  file,
  path,
  storageState,
}: {
  baseUrl: string;
  file: string;
  path: string;
  storageState?: StorageState;
}): Promise<Statement[]> {
  await waitForQuietDatabase(file);
  const context = await request.newContext({ baseURL: baseUrl, storageState });
  const from = Date.now();

  try {
    const response = await context.get(path);
    await response.body();
  } finally {
    await context.dispose();
  }

  await waitForQuietDatabase(file);
  return readStatements(file, { from, to: Date.now() });
}

export type RenderReport = {
  findings: Finding[];
  path: string;
  summary: ReturnType<typeof summarizeStatements>;
};

export function renderRows(renders: RenderReport[]): string[] {
  if (renders.length === 0) {
    return [];
  }

  return [
    "## Database work per render",
    "",
    "Each page's server render on its own, from `ZOONK_QUERY_LOG`.",
    "",
    "| Page | Statements | DB time | Repeated reads | Large results | Filters without an index |",
    "| --- | --- | --- | --- | --- | --- |",
    ...renders.map(({ findings, path, summary }) => {
      const unindexed = findings.filter((finding) => finding.check === "no index").length;
      return `| ${path} | ${summary.count} | ${Math.round(summary.dbMs)} ms | ${summary.repeated.length} | ${summary.large.length} | ${unindexed} |`;
    }),
    "",
  ];
}
