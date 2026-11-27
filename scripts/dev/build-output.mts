import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const LOCAL_STATE = new Set(["cache", "dev", "workflow-data"]);

export function clearProductionBuildOutput(appDirectory: string): void {
  if (!existsSync(join(appDirectory, "next.config.ts"))) {
    return;
  }

  const output = join(appDirectory, ".next");
  const info = lstatSync(output, { throwIfNoEntry: false });

  if (!info) {
    return;
  }

  if (!info.isDirectory()) {
    throw new Error(`Expected a build directory at ${output}.`);
  }

  // Turbo restores its archive over the files already there, including on a cache hit.
  for (const name of readdirSync(output)) {
    if (!LOCAL_STATE.has(name)) {
      rmSync(join(output, name), { force: true, recursive: true });
    }
  }
}
