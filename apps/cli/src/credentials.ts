import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CliError } from "./errors.ts";
import { isRecord } from "./http.ts";

export type StoredLogin = { accessToken: string; expiresAt: number; refreshToken: string };

export type LoginPlace = { file: string; origin: string };

type CredentialsFile = Record<string, unknown>;

const PLAIN_TOKEN_PATTERN = /^[\w\-.~+/]+=*$/u;
const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;

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

function readText(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
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

/** Parallel commands read this file while others write it, so a write never shows half a file. */
function writeCredentials(file: string, credentials: CredentialsFile) {
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  const contents = `${JSON.stringify(credentials, null, 2)}\n`;

  mkdirSync(dirname(file), { mode: OWNER_ONLY_DIRECTORY, recursive: true });
  writeFileSync(temporaryFile, contents, { flag: "wx", mode: OWNER_ONLY_FILE });
  renameSync(temporaryFile, file);
}

export function readLogin({ file, origin }: LoginPlace): StoredLogin | null {
  const login = readCredentials(file)[origin];
  return isStoredLogin(login) ? login : null;
}

export function saveLogin({ file, login, origin }: LoginPlace & { login: StoredLogin }) {
  writeCredentials(file, { ...readCredentials(file), [origin]: login });
}

/** Leaves a newer login alone, such as one saved by a `pnpm zoonk login` that ran meanwhile. */
export function removeLogin({ file, origin, refreshToken }: LoginPlace & { refreshToken: string }) {
  const credentials = readCredentials(file);
  const stored = credentials[origin];

  if (!isStoredLogin(stored) || stored.refreshToken !== refreshToken) {
    return;
  }

  writeCredentials(
    file,
    Object.fromEntries(Object.entries(credentials).filter(([key]) => key !== origin)),
  );
}
