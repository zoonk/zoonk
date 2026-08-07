import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getPortlessEnvironment } from "./config.mts";
import { getPnpmCommand } from "./process.mts";
import {
  type DevelopmentProcessRegistration,
  type DevelopmentProcessStartup,
  getDevelopmentProcessRegistryDirectory,
  readDevelopmentProcessRegistrations,
  readDevelopmentProcessStartups,
  unregisterDevelopmentProcess,
} from "./registry.mts";
import {
  type ExpectedCommand,
  type ProcessSignal,
  getProcessCommand,
  isExpectedProcess,
  signalExpectedProcessTree,
} from "./stop-process.mts";
import {
  type PortlessRouteProcess,
  getPortlessRouteProcesses,
  isDevelopmentLauncherCommand,
  isDevelopmentTaskCommand,
  isDevelopmentTaskRoleCommand,
  isPortlessRouteCommand,
} from "./stop-utils.mts";

const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000;
const FORCED_SHUTDOWN_TIMEOUT_MS = 2000;
const PROCESS_POLL_INTERVAL_MS = 100;
const currentDirectory = process.cwd();
const pnpmCommand = getPnpmCommand(process.env);

type StopResult = { count: number; stopped: boolean };

/** Builds the exact project and task matcher that is allowed to act on one registered child PID. */
function getDevelopmentTaskMatcher(registration: DevelopmentProcessRegistration): ExpectedCommand {
  return (command) =>
    isDevelopmentTaskCommand({
      command,
      currentDirectory: registration.currentDirectory,
      mode: registration.mode,
    });
}

/** Stops the registered task tree directly so a stale launcher PID is never needed to authorize shutdown. */
function requestDevelopmentShutdown(registration: DevelopmentProcessRegistration): void {
  signalExpectedProcessTree({
    isExpectedCommand: getDevelopmentTaskMatcher(registration),
    processId: registration.childProcessId,
    signal: "SIGTERM",
  });
}

/** Escalates the registered task tree after graceful shutdown times out so no nested server can keep a port open indefinitely. */
function forceDevelopmentShutdown({
  registration,
  signal,
}: {
  registration: DevelopmentProcessRegistration;
  signal: "SIGKILL" | "SIGTERM";
}): void {
  signalExpectedProcessTree({
    isExpectedCommand: getDevelopmentTaskMatcher(registration),
    processId: registration.childProcessId,
    signal,
  });
}

/** Treats a stack as stopped after its exact project-scoped task runner is no longer present. */
function isDevelopmentStackRunning(registration: DevelopmentProcessRegistration): boolean {
  const command = getProcessCommand(registration.childProcessId);

  if (!command) {
    return false;
  }

  if (registration.registryVersion === 2) {
    return getDevelopmentTaskMatcher(registration)(command);
  }

  return isDevelopmentTaskRoleCommand({ command, mode: registration.mode });
}

/** Checks whether a startup marker still belongs to the Zoonk launcher PID encoded in its filename. */
function isDevelopmentStartupRunning(startup: DevelopmentProcessStartup): boolean {
  return isExpectedProcess({
    isExpectedCommand: isDevelopmentLauncherCommand,
    processId: startup.launcherProcessId,
  });
}

/** Removes markers whose launcher exited before it could publish a complete child registration. */
function pruneStaleDevelopmentStartups(registryDirectory: string): void {
  readDevelopmentProcessStartups(registryDirectory)
    .filter((startup) => !isDevelopmentStartupRunning(startup))
    .forEach(({ path }) => unregisterDevelopmentProcess(path));
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

  pruneStaleDevelopmentStartups(registryDirectory);

  await waitForProcesses({
    isRunning: () =>
      readDevelopmentProcessStartups(registryDirectory).some((startup) =>
        isDevelopmentStartupRunning(startup),
      ),
    timeoutMs: GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  });

  pruneStaleDevelopmentStartups(registryDirectory);

  const hasActiveStartup = readDevelopmentProcessStartups(registryDirectory).some((startup) =>
    isDevelopmentStartupRunning(startup),
  );

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

  return { count: entries.length, stopped: !hasActiveStartup && !isAnyStackRunning() };
}

/** Reads route owners from one dedicated Zoonk Portless state directory, including stacks started before process registration existed. */
function readPortlessRouteProcesses(environment: NodeJS.ProcessEnv): PortlessRouteProcess[] {
  const stateDirectory = environment.PORTLESS_STATE_DIR;

  if (!stateDirectory) {
    return [];
  }

  const routesPath = join(stateDirectory, "routes.json");

  if (!existsSync(routesPath)) {
    return [];
  }

  try {
    return getPortlessRouteProcesses(JSON.parse(readFileSync(routesPath, "utf8")));
  } catch {
    return [];
  }
}

/** Builds the exact Portless route matcher that is allowed to act on one persisted wrapper PID. */
function getPortlessRouteMatcher(routeProcess: PortlessRouteProcess): ExpectedCommand {
  return (command) => isPortlessRouteCommand({ command, routeNames: routeProcess.routeNames });
}

/** Checks whether one persisted Portless wrapper still owns one of the route names recorded for its PID. */
function isPortlessRouteRunning(routeProcess: PortlessRouteProcess): boolean {
  return isExpectedProcess({
    isExpectedCommand: getPortlessRouteMatcher(routeProcess),
    processId: routeProcess.processId,
  });
}

/** Signals one exact Portless wrapper tree after matching its live `--name` argument to persisted route metadata. */
function signalPortlessRoute({
  routeProcess,
  signal,
}: {
  routeProcess: PortlessRouteProcess;
  signal: ProcessSignal;
}): void {
  signalExpectedProcessTree({
    isExpectedCommand: getPortlessRouteMatcher(routeProcess),
    processId: routeProcess.processId,
    signal,
  });
}

/** Stops any remaining Portless wrappers after registered launchers exit, covering crashed and older agent sessions without scanning unrelated ports. */
async function stopPortlessRouteProcesses(environments: NodeJS.ProcessEnv[]): Promise<StopResult> {
  const routeProcesses = environments.flatMap((environment) =>
    readPortlessRouteProcesses(environment),
  );

  const isAnyRouteRunning = () =>
    routeProcesses.some((routeProcess) => isPortlessRouteRunning(routeProcess));

  routeProcesses.forEach((routeProcess) =>
    signalPortlessRoute({ routeProcess, signal: "SIGTERM" }),
  );

  await waitForProcesses({ isRunning: isAnyRouteRunning, timeoutMs: FORCED_SHUTDOWN_TIMEOUT_MS });

  routeProcesses.forEach((routeProcess) =>
    signalPortlessRoute({ routeProcess, signal: "SIGKILL" }),
  );

  await waitForProcesses({ isRunning: isAnyRouteRunning, timeoutMs: FORCED_SHUTDOWN_TIMEOUT_MS });

  return { count: routeProcesses.length, stopped: !isAnyRouteRunning() };
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
    execFileSync(pnpmCommand.command, [...pnpmCommand.args, "exec", "portless", ...args], {
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
