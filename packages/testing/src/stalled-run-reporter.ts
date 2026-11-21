import { type Reporter, type TestCase } from "vitest/node";

function nameOf(testCase: TestCase) {
  return `${testCase.project.name} › ${testCase.module.relativeModuleId} › ${testCase.fullName}`;
}

/**
 * Ends a run with an error naming what was running once nothing has started or finished for
 * `quietMs`. A browser test's timeouts run in its page, and Chrome's network process answers
 * Vitest's heartbeat, so a page Chrome blocks never times out and the run waits forever
 * (https://github.com/vitest-dev/vitest/pull/10956).
 */
export function stalledRunReporter({ quietMs }: { quietMs: number }): Reporter {
  const running = new Set<string>();
  const timer: { current?: NodeJS.Timeout } = {};

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
    timer.current = setTimeout(fail, quietMs).unref();
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
    onTestCaseReady: (testCase) => started(nameOf(testCase)),
    onTestCaseResult: (testCase) => finished(nameOf(testCase)),
    onTestModuleCollected: heard,
    onTestModuleEnd: (testModule) => finished(testModule.relativeModuleId),
    onTestModuleQueued: heard,
    onTestModuleStart: (testModule) => started(testModule.relativeModuleId),
    onTestRunEnd: () => clearTimeout(timer.current),
    onTestRunStart: heard,
  };
}
