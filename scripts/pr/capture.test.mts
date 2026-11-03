import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, it } from "vitest";

const execute = promisify(execFile);
const CLI = resolve(import.meta.dirname, "capture.mts");

describe("the pr:capture command line", () => {
  it("prints its usage on --help", async () => {
    const { stdout } = await execute(process.execPath, [CLI, "--help"]);
    assert.match(stdout, /Usage: pnpm pr:capture <before\|after>/u);
  });

  it("refuses a run without a side or with both paths and steps, showing the usage", async () => {
    for (const args of [["sideways", "/"], ["after", "/", "--steps", "steps.mts"], ["after"]]) {
      // oxlint-disable-next-line no-await-in-loop -- Each run is a separate process to check.
      await assert.rejects(execute(process.execPath, [CLI, ...args]), {
        stderr: /Name a side, then paths or --steps, not both\.\n\nUsage:/u,
      });
    }
  });
});
