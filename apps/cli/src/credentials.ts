import { randomUUID } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { CliError } from "./errors.ts";
import { OAUTH_TIMEOUT_MS, isRecord } from "./http.ts";

export type StoredLogin = { accessToken: string; expiresAt: number; refreshToken: string };

export type LoginPlace = { file: string; origin: string };

type CredentialsFile = Record<string, unknown>;

type LoginChange<T> = { result: T; save?: StoredLogin | null };

const PLAIN_TOKEN_PATTERN = /^[\w\-.~+/]+=*$/u;
const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;
const LOCK_RETRY_MS = 50;

/** A live command holds the lock for at most one OAuth request, so an older lock was abandoned. */
const LOCK_STALE_MS = OAUTH_TIMEOUT_MS * 2;

export function credentialsPath(environment: NodeJS.ProcessEnv): string {
  const configHome = environment.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configHome, "zoonk", "credentials.json");
}

/** RFC 6750's token characters, so a token can't break a header or a line of output. */
export function isPlainToken(value: unknown): value is string {
  return typeof value === "string" && PLAIN_TOKEN_PATTERN.test(value);
}

function isStoredLogin(value: unknown): value is StoredLogin {
  return (
    isRecord(value) &&
    isPlainToken(value.accessToken) &&
    isPlainToken(value.refreshToken) &&
    typeof value.expiresAt === "number"
  );
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function readText(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }
}

function readCredentials(file: string): CredentialsFile {
  const text = readText(file);

  if (text === null) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : {};
  } catch {
    throw new CliError(`${file} isn't valid JSON. Delete it and log in again.`);
  }
}

/** Commands read this file without the lock, so a write never shows half a file. */
function writeLogin({ file, login, origin }: LoginPlace & { login: StoredLogin | null }) {
  const others = Object.entries(readCredentials(file)).filter(([key]) => key !== origin);
  const credentials = Object.fromEntries(login ? [...others, [origin, login]] : others);
  const temporaryFile = `${file}.${randomUUID()}.tmp`;

  writeFileSync(temporaryFile, `${JSON.stringify(credentials, null, 2)}\n`, {
    flag: "wx",
    mode: OWNER_ONLY_FILE,
  });

  renameSync(temporaryFile, file);
}

function tryLock(lockFile: string): boolean {
  try {
    closeSync(openSync(lockFile, "wx", OWNER_ONLY_FILE));
    return true;
  } catch (error) {
    if (hasErrorCode(error, "EEXIST")) {
      return false;
    }

    throw error;
  }
}

function isAbandoned(lockFile: string): boolean {
  const lock = statSync(lockFile, { throwIfNoEntry: false });
  return lock !== undefined && Date.now() - lock.mtimeMs > LOCK_STALE_MS;
}

async function acquireLock(lockFile: string): Promise<void> {
  if (tryLock(lockFile)) {
    return;
  }

  if (isAbandoned(lockFile)) {
    rmSync(lockFile, { force: true });
  } else {
    await delay(LOCK_RETRY_MS);
  }

  return acquireLock(lockFile);
}

export function readLogin({ file, origin }: LoginPlace): StoredLogin | null {
  const login = readCredentials(file)[origin];
  return isStoredLogin(login) ? login : null;
}

/**
 * Every read-then-write of the file runs here, one command at a time, so two commands never
 * refresh with the same token or drop each other's write. `save: null` removes the login.
 */
export async function changeLogin<T>({
  change,
  file,
  origin,
}: LoginPlace & { change: (stored: StoredLogin | null) => Promise<LoginChange<T>> }): Promise<T> {
  const lockFile = `${file}.lock`;

  mkdirSync(dirname(file), { mode: OWNER_ONLY_DIRECTORY, recursive: true });
  await acquireLock(lockFile);

  try {
    const { result, save } = await change(readLogin({ file, origin }));

    if (save !== undefined) {
      writeLogin({ file, login: save, origin });
    }

    return result;
  } finally {
    rmSync(lockFile, { force: true });
  }
}

export function saveLogin({ file, login, origin }: LoginPlace & { login: StoredLogin }) {
  return changeLogin({ change: async () => ({ result: login, save: login }), file, origin });
}
