import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Points `tmpdir()` at a folder of this run's own, removed when the run ends, so no test leaves folders behind. */
export default function setupTestTempFolder(): () => void {
  const folder = mkdtempSync(join(tmpdir(), "zoonk-test-run-"));

  // Node reads TMPDIR on macOS and Linux and TEMP or TMP on Windows.
  for (const name of ["TMPDIR", "TEMP", "TMP"]) {
    process.env[name] = folder;
  }

  return () => rmSync(folder, { force: true, recursive: true });
}
