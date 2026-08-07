import { type DevelopmentMode } from "./registry.mts";

export type PortlessRouteProcess = { processId: number; routeNames: string[] };

type PortlessRouteOwner = { processId: number; routeName: string };

const PORTLESS_HOSTNAME_SUFFIXES = [".localhost", ".local"];
const PORTLESS_ROUTE_NAME_LABEL_COUNT = 2;

/** Makes Windows and POSIX process listings comparable before applying the same ownership checks. */
function normalizeCommand(command: string): string {
  return command.replaceAll("\\", "/");
}

/** Prevents persisted paths and route names from changing the regular expressions used for process ownership checks. */
function escapeRegularExpression(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/** Checks one complete command-line argument so similarly prefixed worktree paths cannot match each other. */
function hasExactCommandArgument({
  argument,
  command,
}: {
  argument: string;
  command: string;
}): boolean {
  const escapedArgument = escapeRegularExpression(normalizeCommand(argument));
  const pattern = new RegExp(`(?:^|\\s|["'])${escapedArgument}(?=\\s|$|["'])`, "u");

  return pattern.test(normalizeCommand(command));
}

/** Maps a registered development mode to the one Turbo task that launcher is allowed to own. */
function getDevelopmentTaskName(mode: DevelopmentMode): "dev" | "dev:direct" {
  return mode === "direct" ? "dev:direct" : "dev";
}

/** Derives the explicit service and project name after removing Portless's domain and optional worktree prefix. */
function getPortlessRouteName(hostname: string): string | null {
  const suffix = PORTLESS_HOSTNAME_SUFFIXES.find((candidate) => hostname.endsWith(candidate));

  if (!suffix || hostname.length === suffix.length) {
    return null;
  }

  const labels = hostname.slice(0, -suffix.length).split(".");

  if (labels.length < PORTLESS_ROUTE_NAME_LABEL_COUNT) {
    return null;
  }

  return labels.slice(-PORTLESS_ROUTE_NAME_LABEL_COUNT).join(".");
}

/** Reads the PID and route identity together so a stale route cannot authorize an unrelated Portless wrapper after PID reuse. */
function getPortlessRouteOwner(route: unknown): PortlessRouteOwner | null {
  if (!route || typeof route !== "object" || !("hostname" in route) || !("pid" in route)) {
    return null;
  }

  const processId = route.pid;

  const routeName =
    typeof route.hostname === "string" ? getPortlessRouteName(route.hostname) : null;

  if (!Number.isSafeInteger(processId) || Number(processId) <= 0 || !routeName) {
    return null;
  }

  return { processId: Number(processId), routeName };
}

/** Collects every alias for one wrapper without losing the PID that Portless expects shutdown tools to signal. */
function getPortlessRouteProcess({
  processId,
  routeOwners,
}: {
  processId: number;
  routeOwners: PortlessRouteOwner[];
}): PortlessRouteProcess {
  const routeNames = routeOwners
    .filter((owner) => owner.processId === processId)
    .map((owner) => owner.routeName);

  return { processId, routeNames: [...new Set(routeNames)] };
}

/** Matches the exact `--name` value used to launch one Portless route without accepting another project's prefix. */
function hasPortlessRouteName({
  command,
  routeName,
}: {
  command: string;
  routeName: string;
}): boolean {
  const escapedRouteName = escapeRegularExpression(routeName);

  const routePattern = new RegExp(
    `(?:^|\\s)--name(?:=|\\s+)["']?${escapedRouteName}["']?(?=\\s|$)`,
    "u",
  );

  return routePattern.test(command);
}

/** Recognizes a legacy task's recorded mode without treating that weaker match as permission to signal its PID. */
export function isDevelopmentTaskRoleCommand({
  command,
  mode,
}: {
  command: string;
  mode: DevelopmentMode;
}): boolean {
  const normalizedCommand = normalizeCommand(command);
  const taskName = getDevelopmentTaskName(mode);

  const taskPattern = new RegExp(
    `(?:^|[/\\s"'])turbo(?:\\.exe)?["']?\\s+${escapeRegularExpression(taskName)}(?:\\s|$)`,
    "u",
  );

  return taskPattern.test(normalizedCommand);
}

/** Confirms a startup marker still belongs to a live Zoonk launcher before stop waits on it. */
export function isDevelopmentLauncherCommand(command: string): boolean {
  const normalizedCommand = normalizeCommand(command);

  return /(?:^|[/\s"'])scripts\/dev\/start\.mts(?=\s|$|["'])/u.test(normalizedCommand);
}

/** Confirms a detached child belongs to the exact project and mode stored by the development launcher. */
export function isDevelopmentTaskCommand({
  command,
  currentDirectory,
  mode,
}: {
  command: string;
  currentDirectory: string;
  mode: DevelopmentMode;
}): boolean {
  return (
    isDevelopmentTaskRoleCommand({ command, mode }) &&
    hasExactCommandArgument({ argument: `--cwd=${currentDirectory}`, command })
  );
}

/** Returns each Portless wrapper once while retaining every alias that can prove which route the live command owns. */
export function getPortlessRouteProcesses(routes: unknown): PortlessRouteProcess[] {
  if (!Array.isArray(routes)) {
    return [];
  }

  const routeOwners = routes
    .map((route) => getPortlessRouteOwner(route))
    .filter((owner): owner is PortlessRouteOwner => owner !== null);

  const processIds = [...new Set(routeOwners.map((owner) => owner.processId))];

  return processIds.map((processId) => getPortlessRouteProcess({ processId, routeOwners }));
}

/** Confirms a Portless PID still owns one exact persisted route instead of another project that reused the process ID. */
export function isPortlessRouteCommand({
  command,
  routeNames,
}: {
  command: string;
  routeNames: string[];
}): boolean {
  const normalizedCommand = normalizeCommand(command);

  const isPortlessRun = /(?:^|[/\s"'])portless\/dist\/cli\.js["']?\s+run(?:\s|$)/u.test(
    normalizedCommand,
  );

  if (!isPortlessRun) {
    return false;
  }

  return routeNames.some((routeName) =>
    hasPortlessRouteName({ command: normalizedCommand, routeName }),
  );
}
