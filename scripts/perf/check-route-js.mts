/* oxlint-disable no-console -- This CLI prints route budget and artifact tables for CI. */
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";

type Budgets = { version: number; routes: Record<string, number> };
type RouteStats = { route: string; firstLoadChunkPaths: string[] };

const MAX_GROWTH_PERCENT = 103;

const { values } = parseArgs({
  options: {
    budgets: { default: "apps/main/perf-budgets.json", type: "string" },
    dist: { default: "apps/main/.next-e2e", type: "string" },
  },
});

const dist = resolve(values.dist);

function inside({ directory, path }: { directory: string; path: string }): string {
  const file = resolve(directory, path);
  const from = relative(directory, file);

  if (from.startsWith(`..${sep}`) || from === ".." || isAbsolute(from)) {
    throw new Error(`Artifact path escapes ${directory}: ${path}`);
  }

  return file;
}

async function json<T>(file: string): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Invalid build artifact shapes fail at the owning boundary.
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function checkJavaScript(): Promise<void> {
  const [stats, budgets] = await Promise.all([
    json<RouteStats[]>(resolve(dist, "diagnostics/route-bundle-stats.json")),
    json<Budgets>(resolve(values.budgets)),
  ]);

  if (budgets.version !== 1 || !budgets.routes || !Array.isArray(stats) || stats.length === 0) {
    throw new Error("Expected version 1 budgets and nonempty route-bundle-stats.");
  }

  const failures: string[] = [];
  const gzipBytes = new Map<string, Promise<number>>();

  async function chunkBytes(chunk: string): Promise<number> {
    const prefix = `${basename(dist)}/`;

    if (!chunk.startsWith(`${prefix}static/`) || !chunk.endsWith(".js")) {
      throw new Error(`Invalid first-load JavaScript chunk: ${chunk}`);
    }

    const file = inside({ directory: dist, path: chunk.slice(prefix.length) });
    const pending = gzipBytes.get(file) ?? readFile(file).then((bytes) => gzipSync(bytes).length);
    gzipBytes.set(file, pending);
    return pending;
  }

  const rows = await Promise.all(
    stats.map(async (entry) => {
      if (
        !entry.route ||
        !Array.isArray(entry.firstLoadChunkPaths) ||
        entry.firstLoadChunkPaths.length === 0
      ) {
        throw new Error("Every route must list its first-load chunks.");
      }

      const sizes = await Promise.all(
        [...new Set(entry.firstLoadChunkPaths)].map((chunk) => chunkBytes(chunk)),
      );

      const actual = sizes.reduce((sum, size) => sum + size, 0);
      const baseline = budgets.routes[entry.route] ?? 0;
      const valid = Number.isSafeInteger(baseline) && baseline > 0;
      const passes = valid && actual * 100 <= baseline * MAX_GROWTH_PERCENT;

      if (!passes) {
        failures.push(`${entry.route}: ${valid ? "exceeds 3% growth" : "missing valid budget"}`);
      }

      return {
        "actual gzip B": actual,
        "baseline gzip B": valid ? baseline : "MISSING",
        growth: valid ? `${((actual / baseline - 1) * 100).toFixed(2)}%` : "n/a",
        result: passes ? "PASS" : "FAIL",
        route: entry.route,
      };
    }),
  );

  const routes = new Set(stats.map((entry) => entry.route));

  if (routes.size !== stats.length) {
    failures.push("Duplicate routes in route-bundle-stats.");
  }

  for (const route of Object.keys(budgets.routes)) {
    if (!routes.has(route)) {
      failures.push(`${route}: budgeted route missing from build`);
    }
  }

  console.table(rows.toSorted((a, b) => a.route.localeCompare(b.route)));

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}

try {
  await checkJavaScript();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
