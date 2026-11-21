import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function pointTempFolderAt(folder: string) {
  // Node reads TMPDIR on macOS and Linux and TEMP or TMP on Windows.
  for (const name of ["TMPDIR", "TEMP", "TMP"]) {
    process.env[name] = folder;
  }
}

export default function giveTestRunItsOwnTempFolder(): () => void {
  const parent = tmpdir();
  const folder = mkdtempSync(join(parent, "zoonk-test-run-"));
  const remove = () => rmSync(folder, { force: true, recursive: true });

  pointTempFolderAt(folder);
  process.once("exit", remove);

  return () => {
    process.off("exit", remove);
    remove();
    pointTempFolderAt(parent);
  };
}
