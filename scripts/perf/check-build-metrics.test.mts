import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, it } from "vitest";

const run = promisify(execFile);

describe("performance gates", () => {
  it("build time/RSS warn over budget without failing CI", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zoonk-build-metrics-"));
    const metrics = join(directory, "time.txt");

    async function check(output: string) {
      await writeFile(metrics, output);

      return run(process.execPath, [
        resolve(import.meta.dirname, "check-build-metrics.mts"),
        "--metrics",
        metrics,
      ]);
    }

    try {
      const good = await check(
        "Elapsed (wall clock) time (h:mm:ss or m:ss): 2:59.99\nMaximum resident set size (kbytes): 8388608\n",
      );

      assert.match(good.stdout, /E2E build: 179.99 s; maximum RSS 8192 MiB/u);
      assert.doesNotMatch(good.stdout, /::warning/u);

      const slow = await check(
        "Elapsed (wall clock) time (h:mm:ss or m:ss): 3:00.01\nMaximum resident set size (kbytes): 8388609\n",
      );

      assert.match(slow.stdout, /warning title=E2E build time/u);
      assert.match(slow.stdout, /warning title=E2E build RSS/u);
      const missing = await check("missing fields");
      assert.match(missing.stdout, /warning title=E2E build metrics/u);
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
