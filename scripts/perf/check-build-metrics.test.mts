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
        "Elapsed (wall clock) time (h:mm:ss or m:ss): 0:59.99\nMaximum resident set size (kbytes): 6291456\n",
      );

      assert.doesNotMatch(good.stdout, /::warning/u);

      const slow = await check(
        "Elapsed (wall clock) time (h:mm:ss or m:ss): 1:01.01\nMaximum resident set size (kbytes): 6291457\n",
      );

      assert.match(slow.stdout, /warning title=Main build time/u);
      assert.match(slow.stdout, /warning title=Main build RSS/u);
      const missing = await check("missing fields");
      assert.match(missing.stdout, /warning title=Main build metrics/u);
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
