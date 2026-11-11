import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { credentialsPath, readLogin, removeLogin, saveLogin } from "./credentials.ts";

const PRODUCTION = "https://api.zoonk.com";
const LOCAL = "http://api.zoonk.localhost:1355";
const directories: string[] = [];

function createCredentialsFile(): string {
  const configHome = mkdtempSync(join(tmpdir(), "zoonk-cli-"));
  directories.push(configHome);
  return credentialsPath({ XDG_CONFIG_HOME: configHome });
}

function login(name: string) {
  return { accessToken: `access-${name}`, expiresAt: 1, refreshToken: `refresh-${name}` };
}

function permissions(path: string): string {
  return statSync(path).mode.toString(8).slice(-3);
}

describe("credentials file", () => {
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("keeps one owner-only login per API", () => {
    const file = createCredentialsFile();

    saveLogin({ file, login: login("production"), origin: PRODUCTION });
    saveLogin({ file, login: login("local"), origin: LOCAL });
    saveLogin({ file, login: login("production-renewed"), origin: PRODUCTION });

    expect(readLogin({ file, origin: PRODUCTION })).toStrictEqual(login("production-renewed"));
    expect(readLogin({ file, origin: LOCAL })).toStrictEqual(login("local"));
    expect(file).toMatch(/\/zoonk\/credentials\.json$/u);
    expect(permissions(file)).toBe("600");
    expect(permissions(dirname(file))).toBe("700");
    expect(readdirSync(dirname(file))).toStrictEqual(["credentials.json"]);
  });

  it("removes a login only while it still holds the given refresh token", () => {
    const file = createCredentialsFile();

    saveLogin({ file, login: login("newer"), origin: PRODUCTION });
    saveLogin({ file, login: login("local"), origin: LOCAL });

    removeLogin({ file, origin: PRODUCTION, refreshToken: login("older").refreshToken });
    expect(readLogin({ file, origin: PRODUCTION })).toStrictEqual(login("newer"));

    removeLogin({ file, origin: PRODUCTION, refreshToken: login("newer").refreshToken });
    expect(readLogin({ file, origin: PRODUCTION })).toBeNull();
    expect(readLogin({ file, origin: LOCAL })).toStrictEqual(login("local"));
  });
});
