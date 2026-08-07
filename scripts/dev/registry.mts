import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export type DevelopmentMode = "direct" | "lan" | "localhost";

export type DevelopmentProcessRegistration = {
  childProcessId: number;
  currentDirectory: string;
  launcherProcessId: number;
  mode: DevelopmentMode;
  registryVersion?: 2;
};

type StoredDevelopmentProcessRegistration = {
  path: string;
  registration: DevelopmentProcessRegistration;
};

export type DevelopmentProcessStartup = { launcherProcessId: number; path: string };

/** Keeps process ownership outside every clone and linked worktree so one stop command can find all Zoonk development stacks started by other agents. */
export function getDevelopmentProcessRegistryDirectory(homeDirectory: string): string {
  return join(homeDirectory, ".zoonk-dev-processes");
}

/** Derives the record path from the launcher process so startup and shutdown always address the same file without sharing mutable state. */
export function getDevelopmentProcessRegistrationPath({
  launcherProcessId,
  registryDirectory,
}: {
  launcherProcessId: number;
  registryDirectory: string;
}): string {
  return join(registryDirectory, `${launcherProcessId}.json`);
}

/** Creates a visible startup marker before Turbo is spawned so a concurrent stop waits for its complete registration. */
export function registerDevelopmentProcessStartup({
  launcherProcessId,
  registryDirectory,
}: {
  launcherProcessId: number;
  registryDirectory: string;
}): string {
  mkdirSync(registryDirectory, { recursive: true });

  const startupPath = join(registryDirectory, `${launcherProcessId}.starting`);

  writeFileSync(startupPath, "", { mode: 0o600 });

  return startupPath;
}

/** Parses only startup filenames created by this registry so unrelated directory contents never become process IDs. */
function getDevelopmentProcessStartup({
  fileName,
  registryDirectory,
}: {
  fileName: string;
  registryDirectory: string;
}): DevelopmentProcessStartup | null {
  const match = /^(?<launcherProcessId>\d+)\.starting$/u.exec(fileName);
  const launcherProcessId = Number(match?.groups?.launcherProcessId);

  if (!Number.isSafeInteger(launcherProcessId) || launcherProcessId <= 0) {
    return null;
  }

  return { launcherProcessId, path: join(registryDirectory, fileName) };
}

/** Lists startup markers with valid launcher PIDs so stop can wait for live launchers and discard markers left by crashes. */
export function readDevelopmentProcessStartups(
  registryDirectory: string,
): DevelopmentProcessStartup[] {
  if (!existsSync(registryDirectory)) {
    return [];
  }

  return readdirSync(registryDirectory)
    .map((fileName) => getDevelopmentProcessStartup({ fileName, registryDirectory }))
    .filter((startup): startup is DevelopmentProcessStartup => startup !== null);
}

/** Recognizes the three launcher modes without narrowing an unknown JSON value through a type assertion. */
function isDevelopmentMode(value: unknown): value is DevelopmentMode {
  return value === "direct" || value === "lan" || value === "localhost";
}

/** Rejects stale or partially written records before their process IDs can be used to send operating-system signals. */
function isDevelopmentProcessRegistration(value: unknown): value is DevelopmentProcessRegistration {
  if (!value || typeof value !== "object") {
    return false;
  }

  const registration = value as Partial<DevelopmentProcessRegistration>;

  return (
    Number.isSafeInteger(registration.childProcessId) &&
    Number(registration.childProcessId) > 0 &&
    typeof registration.currentDirectory === "string" &&
    registration.currentDirectory.length > 0 &&
    Number.isSafeInteger(registration.launcherProcessId) &&
    Number(registration.launcherProcessId) > 0 &&
    isDevelopmentMode(registration.mode) &&
    (registration.registryVersion === undefined || registration.registryVersion === 2)
  );
}

/** Reads one registry entry defensively because a machine shutdown can interrupt a write and leave invalid JSON behind. */
function readDevelopmentProcessRegistration(
  registrationPath: string,
): StoredDevelopmentProcessRegistration | null {
  try {
    const registration: unknown = JSON.parse(readFileSync(registrationPath, "utf8"));

    if (!isDevelopmentProcessRegistration(registration)) {
      return null;
    }

    return { path: registrationPath, registration };
  } catch {
    return null;
  }
}

/** Lists only valid JSON process records so unrelated files in the shared directory are never treated as running stacks. */
export function readDevelopmentProcessRegistrations(
  registryDirectory: string,
): StoredDevelopmentProcessRegistration[] {
  if (!existsSync(registryDirectory)) {
    return [];
  }

  return readdirSync(registryDirectory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => readDevelopmentProcessRegistration(join(registryDirectory, fileName)))
    .filter((entry): entry is StoredDevelopmentProcessRegistration => entry !== null);
}

/** Persists the root launcher and its detached task runner before apps start accepting traffic, giving `pnpm dev:stop` an exact process group to stop later. */
export function registerDevelopmentProcess({
  registration,
  registryDirectory,
}: {
  registration: DevelopmentProcessRegistration;
  registryDirectory: string;
}): string {
  mkdirSync(registryDirectory, { recursive: true });

  const registrationPath = getDevelopmentProcessRegistrationPath({
    launcherProcessId: registration.launcherProcessId,
    registryDirectory,
  });

  const temporaryPath = `${registrationPath}.${process.pid}.tmp`;

  try {
    writeFileSync(temporaryPath, `${JSON.stringify(registration, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporaryPath, registrationPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }

  return registrationPath;
}

/** Removes one exact registry file when startup or execution finishes so stale ownership metadata is not reused. */
export function unregisterDevelopmentProcess(registrationPath: string): void {
  rmSync(registrationPath, { force: true });
}
