import { type Reporter, type TestCase, type TestModule } from "vitest/node";

function moduleName(testModule: TestModule) {
  return `${testModule.project.name} › ${testModule.relativeModuleId}`;
}

function caseName(testCase: TestCase) {
  return `${moduleName(testCase.module)} › ${testCase.fullName}`;
}

/**
 * Ends a run with an error naming what was running once nothing has started or finished for
 * `quietMs`, unless a debugger is attached or awaited. A browser test's timeouts run in its page,
 * and Chrome's network process answers Vitest's heartbeat, so a page Chrome blocks never times out
 * and the run waits forever (https://github.com/vitest-dev/vitest/pull/10956).
 */
export function stalledRunReporter({ quietMs }: { quietMs: number }): Reporter {
  const running = new Set<string>();
  const timer: { current?: NodeJS.Timeout } = {};
  const debugging = { current: false };

  function fail() {
    const names = running.size > 0 ? [...running].join("\n  ") : "nothing reported as started";

    process.stderr.write(
      `\nNo test started or finished for ${quietMs / 1000} s, so the run stopped. Still running:\n  ${names}\n`,
    );

    // oxlint-disable-next-line unicorn/no-process-exit -- A thrown error or a cancel waits on the blocked page too; only exiting ends the run.
    process.exit(1);
  }

  function heard() {
    clearTimeout(timer.current);

    if (!debugging.current) {
      timer.current = setTimeout(fail, quietMs).unref();
    }
  }

  function started(name: string) {
    running.add(name);
    heard();
  }

  function finished(name: string) {
    running.delete(name);
    heard();
  }

  return {
    onHookEnd: heard,
    onHookStart: heard,
    onInit: (vitest) => {
      debugging.current = Boolean(vitest.config.inspector.enabled);
    },
    onTestCaseReady: (testCase) => started(caseName(testCase)),
    onTestCaseResult: (testCase) => finished(caseName(testCase)),
    onTestModuleCollected: heard,
    onTestModuleEnd: (testModule) => finished(moduleName(testModule)),
    onTestModuleQueued: (testModule) => started(moduleName(testModule)),
    onTestModuleStart: heard,
    onTestRunEnd: () => clearTimeout(timer.current),
    onTestRunStart: heard,
  };
}
