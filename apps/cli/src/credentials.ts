import { closeSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { CliError } from "./errors.ts";

export type StoredLogin = { accessToken: string; expiresAt: number; refreshToken: string };

export type LoginPlace = { file: string; origin: string };

type LoginChange<T> = { result: T; save?: StoredLogin | null };

const PLAIN_TOKEN_PATTERN = /^[\w\-.~+/]+=*$/u;
const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;
const BUSY_TIMEOUT_MS = 30_000;
const SQLITE_BUSY = 5;

const CREATE_LOGINS = `
  CREATE TABLE IF NOT EXISTS logins (
    origin TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT`;

const SELECT_LOGIN = "SELECT access_token, refresh_token, expires_at FROM logins WHERE origin = ?";

const UPSERT_LOGIN = `
  INSERT INTO logins (origin, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)
  ON CONFLICT (origin) DO UPDATE SET
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at`;

export function credentialsPath(environment: NodeJS.ProcessEnv): string {
  const configHome = environment.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configHome, "zoonk", "credentials.db");
}

/** RFC 6750's token characters, so a token can't break a header or a line of output. */
export function isPlainToken(value: unknown): value is string {
  return typeof value === "string" && PLAIN_TOKEN_PATTERN.test(value);
}

function toStoredLogin(row: Record<string, SQLOutputValue> | undefined): StoredLogin | null {
  if (
    !row ||
    !isPlainToken(row.access_token) ||
    !isPlainToken(row.refresh_token) ||
    typeof row.expires_at !== "number"
  ) {
    return null;
  }

  return {
    accessToken: row.access_token,
    expiresAt: row.expires_at,
    refreshToken: row.refresh_token,
  };
}

/** SQLite would create the file with the umask's default permissions, so it starts owner-only. */
function openCredentials(file: string): DatabaseSync {
  mkdirSync(dirname(file), { mode: OWNER_ONLY_DIRECTORY, recursive: true });
  closeSync(openSync(file, "a", OWNER_ONLY_FILE));

  const database = new DatabaseSync(file, { timeout: BUSY_TIMEOUT_MS });
  database.exec(CREATE_LOGINS);

  return database;
}

function selectLogin(database: DatabaseSync, origin: string): StoredLogin | null {
  return toStoredLogin(database.prepare(SELECT_LOGIN).get(origin));
}

function writeLogin({
  database,
  login,
  origin,
}: {
  database: DatabaseSync;
  login: StoredLogin | null;
  origin: string;
}) {
  if (!login) {
    database.prepare("DELETE FROM logins WHERE origin = ?").run(origin);
    return;
  }

  database
    .prepare(UPSERT_LOGIN)
    .run(origin, login.accessToken, login.refreshToken, login.expiresAt);
}

function isBusy(error: unknown): boolean {
  return error instanceof Error && "errcode" in error && error.errcode === SQLITE_BUSY;
}

function beginImmediate(database: DatabaseSync) {
  try {
    database.exec("BEGIN IMMEDIATE");
  } catch (error) {
    if (isBusy(error)) {
      throw new CliError("Another zoonk command is renewing the login; try again.");
    }

    throw error;
  }
}

export function readLogin({ file, origin }: LoginPlace): StoredLogin | null {
  const database = openCredentials(file);

  try {
    return selectLogin(database, origin);
  } finally {
    database.close();
  }
}

/**
 * Every read-then-write of a login, refresh or revocation included, runs in one `BEGIN IMMEDIATE`
 * transaction, so two commands never send the same refresh token. SQLite's lock lasts as long as
 * its holder, even a suspended one, and ends when the holder's process does. `save: null` removes
 * the login.
 */
export async function changeLogin<T>({
  change,
  file,
  origin,
}: LoginPlace & { change: (stored: StoredLogin | null) => Promise<LoginChange<T>> }): Promise<T> {
  const database = openCredentials(file);

  try {
    beginImmediate(database);

    const { result, save } = await change(selectLogin(database, origin));

    if (save !== undefined) {
      writeLogin({ database, login: save, origin });
    }

    database.exec("COMMIT");
    return result;
  } catch (error) {
    if (database.isTransaction) {
      database.exec("ROLLBACK");
    }

    throw error;
  } finally {
    database.close();
  }
}

export function saveLogin({ file, login, origin }: LoginPlace & { login: StoredLogin }) {
  return changeLogin({ change: async () => ({ result: login, save: login }), file, origin });
}
