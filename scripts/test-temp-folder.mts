import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default function giveTestRunItsOwnTempFolder(): () => void {
  const folder = mkdtempSync(join(tmpdir(), "zoonk-test-run-"));
  const remove = () => rmSync(folder, { force: true, recursive: true });

  // Node reads TMPDIR on macOS and Linux and TEMP or TMP on Windows.
  for (const name of ["TMPDIR", "TEMP", "TMP"]) {
    process.env[name] = folder;
  }

  process.once("exit", remove);

  return () => {
    process.off("exit", remove);
    remove();
  };
}
