import {
  type DevelopmentProcessStartup,
  readDevelopmentProcessStartups,
  unregisterDevelopmentProcess,
} from "./registry.mts";
import {
  type ProcessSignal,
  isExpectedProcess,
  signalExpectedProcessTree,
  waitForProcesses,
} from "./stop-process.mts";
import { isDevelopmentLauncherCommand } from "./stop-utils.mts";

/** Checks whether a startup marker still belongs to the Zoonk launcher PID encoded in its filename. */
function isDevelopmentStartupRunning(startup: DevelopmentProcessStartup): boolean {
  return isExpectedProcess({
    isExpectedCommand: isDevelopmentLauncherCommand,
    processId: startup.launcherProcessId,
  });
}

/** Returns only startup markers whose launcher command still proves that the PID belongs to this workflow. */
function readActiveDevelopmentStartups(registryDirectory: string): DevelopmentProcessStartup[] {
  return readDevelopmentProcessStartups(registryDirectory).filter((startup) =>
    isDevelopmentStartupRunning(startup),
  );
}

/** Removes markers whose launcher exited before it could publish a complete child registration. */
function pruneStaleDevelopmentStartups(registryDirectory: string): void {
  readDevelopmentProcessStartups(registryDirectory)
    .filter((startup) => !isDevelopmentStartupRunning(startup))
    .forEach(({ path }) => unregisterDevelopmentProcess(path));
}

/** Signals every launcher still blocked before registration so it cannot start a new stack after proxy cleanup. */
function signalActiveDevelopmentStartups({
  registryDirectory,
  signal,
}: {
  registryDirectory: string;
  signal: ProcessSignal;
}): void {
  readActiveDevelopmentStartups(registryDirectory).forEach(({ launcherProcessId }) =>
    signalExpectedProcessTree({
      isExpectedCommand: isDevelopmentLauncherCommand,
      processId: launcherProcessId,
      signal,
    }),
  );
}

/** Waits for normal startup, then terminates launchers that remain blocked before publishing their task registration. */
export async function stopDevelopmentStartups({
  forcedTimeoutMs,
  gracefulTimeoutMs,
  registryDirectory,
}: {
  forcedTimeoutMs: number;
  gracefulTimeoutMs: number;
  registryDirectory: string;
}): Promise<boolean> {
  pruneStaleDevelopmentStartups(registryDirectory);

  const isAnyStartupRunning = () => readActiveDevelopmentStartups(registryDirectory).length > 0;

  await waitForProcesses({ isRunning: isAnyStartupRunning, timeoutMs: gracefulTimeoutMs });
  signalActiveDevelopmentStartups({ registryDirectory, signal: "SIGTERM" });
  await waitForProcesses({ isRunning: isAnyStartupRunning, timeoutMs: forcedTimeoutMs });
  signalActiveDevelopmentStartups({ registryDirectory, signal: "SIGKILL" });
  await waitForProcesses({ isRunning: isAnyStartupRunning, timeoutMs: forcedTimeoutMs });

  pruneStaleDevelopmentStartups(registryDirectory);

  return !isAnyStartupRunning();
}
