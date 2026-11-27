import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { clearProductionBuildOutput } from "./build-output.mts";

test("clears the previous production build while preserving local runtime state", () => {
  const directory = mkdtempSync(join(tmpdir(), "dev-build-output-"));
  const preserved = [".next/cache", ".next/dev", ".next/workflow-data", ".next-e2e"];
  const obsolete = [".next/static", ".next/server", ".next/BUILD_ID"];

  try {
    writeFileSync(join(directory, "next.config.ts"), "");

    for (const path of [...preserved, ...obsolete.slice(0, 2)]) {
      mkdirSync(join(directory, path), { recursive: true });
      writeFileSync(join(directory, path, "file"), "");
    }

    writeFileSync(join(directory, ".next/BUILD_ID"), "previous");
    clearProductionBuildOutput(directory);

    expect(obsolete.filter((path) => existsSync(join(directory, path)))).toStrictEqual([]);

    expect(preserved.filter((path) => existsSync(join(directory, path, "file")))).toStrictEqual(
      preserved,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
