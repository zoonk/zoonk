import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { isJsonObject } from "@zoonk/utils/json";
import { type Reporter, type TestModule, type Vitest } from "vitest/node";

function readDurations(path: string): Record<string, number> {
  const recorded: unknown = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};

  return Object.fromEntries(
    Object.entries(isJsonObject(recorded) ? recorded : {}).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

/**
 * Records how long each test file took in the package's `vitest.durations.json`, which CI's
 * shards are split by (see `duration-sequencer.ts`): its whole cost, the worker, environment and
 * imports as well as its tests. A run of some files updates theirs and keeps the rest; files that
 * no longer exist leave. A package runs it with `pnpm test:durations` after adding or reshaping
 * slow tests.
 */
export default class DurationsReporter implements Reporter {
  private root = process.cwd();

  onInit(vitest: Vitest) {
    this.root = vitest.config.root;
  }

  onTestRunEnd(testModules: readonly TestModule[]) {
    const path = resolve(this.root, "vitest.durations.json");
    const recorded = readDurations(path);

    const measured = Object.fromEntries(
      testModules.map((module) => {
        const time = module.diagnostic();

        return [
          relative(this.root, module.moduleId),
          Math.round(
            time.environmentSetupDuration +
              time.prepareDuration +
              time.collectDuration +
              time.setupDuration +
              time.duration,
          ),
        ];
      }),
    );

    const durations = Object.entries({ ...recorded, ...measured })
      .filter(([file]) => existsSync(resolve(this.root, file)))
      .toSorted(([a], [b]) => a.localeCompare(b));

    writeFileSync(path, `${JSON.stringify(Object.fromEntries(durations), null, 2)}\n`);
  }
}
