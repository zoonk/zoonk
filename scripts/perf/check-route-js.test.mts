import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, it } from "vitest";

const run = promisify(execFile);
const script = resolve(import.meta.dirname, "check-route-js.mts");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "zoonk-perf-gate-"));
  const dist = join(root, ".next-e2e");
  const budgets = join(root, "budgets.json");

  await Promise.all([
    mkdir(join(dist, "diagnostics"), { recursive: true }),
    mkdir(join(dist, "static/chunks"), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(
      join(dist, "static/chunks/shared.js"),
      Buffer.from(Array.from({ length: 83 }, (_, index) => index)),
    ),
    writeFile(
      join(dist, "diagnostics/route-bundle-stats.json"),
      JSON.stringify([
        {
          firstLoadChunkPaths: [
            ".next-e2e/static/chunks/shared.js",
            ".next-e2e/static/chunks/shared.js",
          ],
          route: "/[lang]",
        },
      ]),
    ),
    writeFile(budgets, JSON.stringify({ routes: { "/[lang]": 100 }, version: 1 })),
  ]);

  return { budgets, dist, root };
}

async function check(data: Awaited<ReturnType<typeof fixture>>) {
  return run(process.execPath, [script, "--dist", data.dist, "--budgets", data.budgets]);
}

describe("route JavaScript budget gates", () => {
  it("route JS deduplicates chunks and allows exactly 3 percent growth", async () => {
    const data = await fixture();

    try {
      const before = await readFile(data.budgets, "utf8");
      const { stdout } = await check(data);
      assert.match(stdout, /PASS/u);
      assert.match(stdout, /3\.00%/u);
      assert.equal(await readFile(data.budgets, "utf8"), before);
      await writeFile(data.budgets, JSON.stringify({ routes: { "/[lang]": 99 }, version: 1 }));
      await assert.rejects(check(data), { code: 1, stderr: /exceeds 3%/u });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });

  it("route JS rejects missing chunks, routes, and unbudgeted additions", async () => {
    const data = await fixture();

    try {
      await writeFile(data.budgets, JSON.stringify({ routes: {}, version: 1 }));
      await assert.rejects(check(data), { code: 1 });
      await writeFile(data.budgets, JSON.stringify({ routes: { "/removed": 100 }, version: 1 }));
      await assert.rejects(check(data), { code: 1, stderr: /budgeted route missing/u });
      await rm(join(data.dist, "static/chunks/shared.js"));
      await assert.rejects(check(data), { code: 1 });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });
});
