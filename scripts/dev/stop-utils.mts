/** Extracts a route owner only when Portless stored a usable operating-system process ID. Static aliases use PID 0 and must never be signaled. */
function getPortlessRouteProcessId(route: unknown): number | null {
  if (!route || typeof route !== "object" || !("pid" in route)) {
    return null;
  }

  const processId = route.pid;

  if (!Number.isSafeInteger(processId) || Number(processId) <= 0) {
    return null;
  }

  return Number(processId);
}

/** Returns each Portless wrapper once because aliases can point multiple hostnames at the same development server. */
export function getPortlessRouteProcessIds(routes: unknown): number[] {
  if (!Array.isArray(routes)) {
    return [];
  }

  const processIds = routes
    .map((route) => getPortlessRouteProcessId(route))
    .filter((processId): processId is number => processId !== null);

  return [...new Set(processIds)];
}

/** Confirms a registered launcher still belongs to the root Zoonk development entrypoint before using its possibly stale process ID. */
export function isDevelopmentLauncherCommand(command: string): boolean {
  return command.split(/\s+/u).includes("scripts/dev/start.mts");
}

/** Confirms a detached child is one of the two Turbo development tasks that the root launcher creates. */
export function isDevelopmentTaskCommand(command: string): boolean {
  return /(?:^|\s)turbo\s+dev(?::direct)?(?:\s|$)/u.test(command);
}

/** Confirms a Portless route PID still owns a Portless `run` wrapper instead of an unrelated process that reused a stale ID. */
export function isPortlessRouteCommand(command: string): boolean {
  return /\/portless\/dist\/cli\.js\s+run(?:\s|$)/u.test(command);
}
