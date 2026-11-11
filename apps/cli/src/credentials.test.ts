import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { changeLogin, credentialsPath, readLogin, saveLogin } from "./credentials.ts";

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

  it("keeps one owner-only login per API", async () => {
    const file = createCredentialsFile();

    await saveLogin({ file, login: login("production"), origin: PRODUCTION });
    await saveLogin({ file, login: login("local"), origin: LOCAL });
    await saveLogin({ file, login: login("production-renewed"), origin: PRODUCTION });

    expect(readLogin({ file, origin: PRODUCTION })).toStrictEqual(login("production-renewed"));
    expect(readLogin({ file, origin: LOCAL })).toStrictEqual(login("local"));
    expect(file).toMatch(/\/zoonk\/credentials\.json$/u);
    expect(permissions(file)).toBe("600");
    expect(permissions(dirname(file))).toBe("700");
    expect(readdirSync(dirname(file))).toStrictEqual(["credentials.json"]);
  });

  it("removes one API's login and frees the lock even when a change fails", async () => {
    const file = createCredentialsFile();

    await saveLogin({ file, login: login("production"), origin: PRODUCTION });
    await saveLogin({ file, login: login("local"), origin: LOCAL });

    await expect(
      changeLogin({
        change: () => Promise.reject(new Error("refresh failed")),
        file,
        origin: PRODUCTION,
      }),
    ).rejects.toThrow("refresh failed");

    await changeLogin({ change: async () => ({ result: null, save: null }), file, origin: LOCAL });

    expect(readLogin({ file, origin: PRODUCTION })).toStrictEqual(login("production"));
    expect(readLogin({ file, origin: LOCAL })).toBeNull();
    expect(readdirSync(dirname(file))).toStrictEqual(["credentials.json"]);
  });

  it("reads a login whose tokens a header can't carry as no login", async () => {
    const file = createCredentialsFile();

    await saveLogin({
      file,
      login: { ...login("broken"), accessToken: "access\r\nX-Injected: yes" },
      origin: PRODUCTION,
    });

    expect(readLogin({ file, origin: PRODUCTION })).toBeNull();
  });
});
