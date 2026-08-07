import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getPortlessEnvironment } from "./config.mts";
import {
  type DevelopmentProcessRegistration,
  getDevelopmentProcessRegistryDirectory,
  readDevelopmentProcessRegistrations,
  unregisterDevelopmentProcess,
} from "./registry.mts";
import {
  getPortlessRouteProcessIds,
  isDevelopmentLauncherCommand,
  isDevelopmentTaskCommand,
  isPortlessRouteCommand,
} from "./stop-utils.mts";

const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000;
const FORCED_SHUTDOWN_TIMEOUT_MS = 2000;
const PROCESS_POLL_INTERVAL_MS = 100;
const currentDirectory = process.cwd();

type ExpectedCommand = (command: string) => boolean;
type ProcessSignal = "SIGINT" | "SIGKILL" | "SIGTERM";
type StopResult = { count: number; stopped: boolean };

/** Reads the command currently attached to a PID so stale registry entries cannot stop an unrelated process after PID reuse. */
function getProcessCommand(processId: number): string | null {
  try {
    return (
      execFileSync("ps", ["-p", String(processId), "-o", "command="], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

/** Reports a process as managed only while its live command still matches the role recorded by the development launcher. */
function isExpectedProcess({
  isExpectedCommand,
  processId,
}: {
  isExpectedCommand: ExpectedCommand;
  processId: number;
}): boolean {
  const command = getProcessCommand(processId);

  return command !== null && isExpectedCommand(command);
}

/** Signals one exact managed process after checking its command immediately before the operating-system call. */
function signalExpectedProcess({
  isExpectedCommand,
  processId,
  signal,
}: {
  isExpectedCommand: ExpectedCommand;
  processId: number;
  signal: ProcessSignal;
}): boolean {
  if (!isExpectedProcess({ isExpectedCommand, processId })) {
    return false;
  }

  try {
    process.kill(processId, signal);
    return true;
  } catch {
    return false;
  }
}

/** Signals the detached Turbo process group so direct-mode servers cannot survive if their root launcher already crashed. */
function signalExpectedProcessGroup({
  isExpectedCommand,
  processId,
  signal,
}: {
  isExpectedCommand: ExpectedCommand;
  processId: number;
  signal: ProcessSignal;
}): boolean {
  if (!isExpectedProcess({ isExpectedCommand, processId })) {
    return false;
  }

  try {
    process.kill(-processId, signal);
    return true;
  } catch {
    return signalExpectedProcess({ isExpectedCommand, processId, signal });
  }
}

/** Gives the root launcher the same interrupt as Ctrl+C, falling back to its task-runner group when the launcher no longer exists. */
function requestDevelopmentShutdown(registration: DevelopmentProcessRegistration): void {
  const launcherSignaled = signalExpectedProcess({
    isExpectedCommand: isDevelopmentLauncherCommand,
    processId: registration.launcherProcessId,
    signal: "SIGINT",
  });

  if (!launcherSignaled) {
    signalExpectedProcessGroup({
      isExpectedCommand: isDevelopmentTaskCommand,
      processId: registration.childProcessId,
      signal: "SIGTERM",
    });
  }
}

/** Escalates both recorded owners after graceful shutdown times out so no nested server can keep a port open indefinitely. */
function forceDevelopmentShutdown({
  registration,
  signal,
}: {
  registration: DevelopmentProcessRegistration;
  signal: "SIGKILL" | "SIGTERM";
}): void {
  signalExpectedProcessGroup({
    isExpectedCommand: isDevelopmentTaskCommand,
    processId: registration.childProcessId,
    signal,
  });

  signalExpectedProcess({
    isExpectedCommand: isDevelopmentLauncherCommand,
    processId: registration.launcherProcessId,
    signal,
  });
}

/** Treats a stack as stopped only after neither its launcher nor its detached task runner still has the expected command. */
function isDevelopmentStackRunning(registration: DevelopmentProcessRegistration): boolean {
  return (
    isExpectedProcess({
      isExpectedCommand: isDevelopmentLauncherCommand,
      processId: registration.launcherProcessId,
    }) ||
    isExpectedProcess({
      isExpectedCommand: isDevelopmentTaskCommand,
      processId: registration.childProcessId,
    })
  );
}

/** Polls briefly for process-owned cleanup, returning early as soon as every target exits. */
function waitForProcesses({
  isRunning,
  timeoutMs,
}: {
  isRunning: () => boolean;
  timeoutMs: number;
}): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve) => {
    /** Rechecks the small managed process set until it exits or reaches the bounded shutdown deadline. */
    function poll(): void {
      if (!isRunning() || Date.now() >= deadline) {
        resolve();
        return;
      }

      setTimeout(poll, PROCESS_POLL_INTERVAL_MS);
    }

    poll();
  });
}

/** Stops every launcher that opted into the shared registry, including fixed-port direct mode. */
async function stopRegisteredDevelopmentStacks(): Promise<StopResult> {
  const registryDirectory = getDevelopmentProcessRegistryDirectory(homedir());
  const entries = readDevelopmentProcessRegistrations(registryDirectory);

  const isAnyStackRunning = () =>
    entries.some(({ registration }) => isDevelopmentStackRunning(registration));

  entries.forEach(({ registration }) => requestDevelopmentShutdown(registration));

  await waitForProcesses({ isRunning: isAnyStackRunning, timeoutMs: GRACEFUL_SHUTDOWN_TIMEOUT_MS });

  entries.forEach(({ registration }) =>
    forceDevelopmentShutdown({ registration, signal: "SIGTERM" }),
  );

  await waitForProcesses({ isRunning: isAnyStackRunning, timeoutMs: FORCED_SHUTDOWN_TIMEOUT_MS });

  entries.forEach(({ registration }) =>
    forceDevelopmentShutdown({ registration, signal: "SIGKILL" }),
  );

  await waitForProcesses({ isRunning: isAnyStackRunning, timeoutMs: FORCED_SHUTDOWN_TIMEOUT_MS });

  entries
    .filter(({ registration }) => !isDevelopmentStackRunning(registration))
    .forEach(({ path }) => unregisterDevelopmentProcess(path));

  return { count: entries.length, stopped: !isAnyStackRunning() };
}

/** Reads route owners from one dedicated Zoonk Portless state directory, including stacks started before process registration existed. */
function readPortlessRouteProcessIds(environment: NodeJS.ProcessEnv): number[] {
  const stateDirectory = environment.PORTLESS_STATE_DIR;

  if (!stateDirectory) {
    return [];
  }

  const routesPath = join(stateDirectory, "routes.json");

  if (!existsSync(routesPath)) {
    return [];
  }

  try {
    return getPortlessRouteProcessIds(JSON.parse(readFileSync(routesPath, "utf8")));
  } catch {
    return [];
  }
}

/** Stops any remaining Portless wrappers after registered launchers exit, covering crashed and older agent sessions without scanning unrelated ports. */
async function stopPortlessRouteProcesses(environments: NodeJS.ProcessEnv[]): Promise<StopResult> {
  const processIds = [
    ...new Set(environments.flatMap((environment) => readPortlessRouteProcessIds(environment))),
  ];

  const isAnyRouteRunning = () =>
    processIds.some((processId) =>
      isExpectedProcess({ isExpectedCommand: isPortlessRouteCommand, processId }),
    );

  processIds.forEach((processId) =>
    signalExpectedProcess({
      isExpectedCommand: isPortlessRouteCommand,
      processId,
      signal: "SIGTERM",
    }),
  );

  await waitForProcesses({ isRunning: isAnyRouteRunning, timeoutMs: FORCED_SHUTDOWN_TIMEOUT_MS });

  processIds.forEach((processId) =>
    signalExpectedProcess({
      isExpectedCommand: isPortlessRouteCommand,
      processId,
      signal: "SIGKILL",
    }),
  );

  await waitForProcesses({ isRunning: isAnyRouteRunning, timeoutMs: FORCED_SHUTDOWN_TIMEOUT_MS });

  return { count: processIds.length, stopped: !isAnyRouteRunning() };
}

/** Runs a Portless maintenance command against one explicit state directory so localhost and LAN proxies never resolve each other's persisted settings. */
function runPortlessCommand({
  args,
  environment,
}: {
  args: string[];
  environment: NodeJS.ProcessEnv;
}): boolean {
  try {
    execFileSync("pnpm", ["exec", "portless", ...args], {
      cwd: currentDirectory,
      env: { ...process.env, ...environment },
      stdio: "inherit",
    });

    return true;
  } catch {
    return false;
  }
}

/** Prunes dead route records before stopping both dedicated proxies, making repeated stop commands safe and leaving no stale LAN names behind. */
function stopPortlessProxies(environments: NodeJS.ProcessEnv[]): boolean {
  const results = environments.flatMap((environment) => [
    runPortlessCommand({ args: ["prune"], environment }),
    runPortlessCommand({ args: ["proxy", "stop"], environment }),
  ]);

  return results.every(Boolean);
}

const portlessEnvironments = [
  getPortlessEnvironment({ homeDirectory: homedir(), lanMode: false }),
  getPortlessEnvironment({ homeDirectory: homedir(), lanMode: true }),
];

const registeredStacks = await stopRegisteredDevelopmentStacks();
const portlessRoutes = await stopPortlessRouteProcesses(portlessEnvironments);
const proxiesStopped = stopPortlessProxies(portlessEnvironments);
const allProcessesStopped = registeredStacks.stopped && portlessRoutes.stopped && proxiesStopped;

if (allProcessesStopped) {
  process.stdout.write(
    `All Zoonk development servers and proxies are stopped (${registeredStacks.count} registered stacks, ${portlessRoutes.count} Portless routes).\n`,
  );
} else {
  process.exitCode = 1;
  process.stderr.write("Some Zoonk development processes could not be stopped.\n");
}
