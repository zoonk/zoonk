import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import { WHOAMI_REQUEST } from "./args.ts";
import { type StoredLogin, credentialsPath, readLogin, saveLogin } from "./credentials.ts";
import { EXIT_CODES } from "./errors.ts";
import { sendAuthorized } from "./session.ts";

type FakeApiOptions = {
  acceptedToken: string;
  beforeRejecting?: () => Promise<unknown>;
  /** `lost`: the server takes the refresh, then the connection drops before the answer. */
  refresh:
    | { body: unknown; delayMs?: number; headers?: Record<string, string>; status: number }
    | "lost";
};

const HOUR_MS = 3_600_000;
const ME = { user: { email: "owner@zoonk.test", id: "user-1", name: "Owner", role: "admin" } };
const MAIN = join(import.meta.dirname, "main.ts");
const directories: string[] = [];
const servers: Server[] = [];

function createCredentialsFile(): string {
  const configHome = mkdtempSync(join(tmpdir(), "zoonk-cli-"));
  directories.push(configHome);
  return credentialsPath({ XDG_CONFIG_HOME: configHome });
}

/** Each CLI command is its own process, waiting on the credentials file's lock without blocking the test. */
function runWhoami({ file, origin }: { file: string; origin: string }): Promise<number | null> {
  const child = spawn(process.execPath, [MAIN, "whoami", "--api", origin], {
    env: { ...process.env, XDG_CONFIG_HOME: dirname(dirname(file)) },
    stdio: "ignore",
  });

  return new Promise((resolve) => {
    child.on("close", resolve);
  });
}

function storedLogin(name: string, expiresAt: number): StoredLogin {
  return { accessToken: `access-${name}`, expiresAt, refreshToken: `refresh-${name}` };
}

function tokenResponse(name: string) {
  return {
    access_token: `access-${name}`,
    expires_in: 3600,
    refresh_token: `refresh-${name}`,
    token_type: "Bearer",
  };
}

async function readForm(request: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
}

function reply({
  body,
  headers,
  response,
  status,
}: {
  body: unknown;
  headers?: Record<string, string>;
  response: ServerResponse;
  status: number;
}) {
  response
    .writeHead(status, { "content-type": "application/json", ...headers })
    .end(JSON.stringify(body));
}

async function startFakeApi(options: FakeApiOptions) {
  const refreshRequests: Record<string, string>[] = [];
  const staffCalls: string[] = [];

  const server = createServer(async (request, response) => {
    if (request.url === "/v1/auth/oauth2/token") {
      refreshRequests.push(await readForm(request));

      if (options.refresh === "lost") {
        request.socket.destroy();
        return;
      }

      await delay(options.refresh.delayMs ?? 0);
      reply({ response, ...options.refresh });
      return;
    }

    const authorization = request.headers.authorization ?? "";
    staffCalls.push(authorization);

    if (authorization === `Bearer ${options.acceptedToken}`) {
      reply({ body: ME, response, status: 200 });
      return;
    }

    await options.beforeRejecting?.();

    reply({
      body: { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      response,
      status: 401,
    });
  });

  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address() as AddressInfo;
  return { origin: `http://127.0.0.1:${port}`, refreshRequests, staffCalls };
}

describe(sendAuthorized, () => {
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise((resolve) => {
            server.close(resolve);
          }),
      ),
    );

    for (const directory of directories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("refreshes an expiring login before the call and saves the new pair", async () => {
    const file = createCredentialsFile();

    const api = await startFakeApi({
      acceptedToken: "access-new",
      refresh: { body: tokenResponse("new"), status: 200 },
    });

    await saveLogin({ file, login: storedLogin("old", Date.now() + 1000), origin: api.origin });

    const result = await sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST });

    expect(result).toStrictEqual({ body: ME, ok: true, status: 200 });

    expect(api.refreshRequests).toStrictEqual([
      { client_id: "zoonk-cli", grant_type: "refresh_token", refresh_token: "refresh-old" },
    ]);

    expect(api.staffCalls).toStrictEqual(["Bearer access-new"]);

    expect(readLogin({ file, origin: api.origin })).toMatchObject({
      accessToken: "access-new",
      refreshToken: "refresh-new",
    });
  });

  it("lets one of two parallel commands refresh and hands the other the saved pair", async () => {
    const file = createCredentialsFile();

    const api = await startFakeApi({
      acceptedToken: "access-new",
      refresh: { body: tokenResponse("new"), delayMs: 100, status: 200 },
    });

    await saveLogin({ file, login: storedLogin("old", Date.now() - 1000), origin: api.origin });

    const exitCodes = await Promise.all([
      runWhoami({ file, origin: api.origin }),
      runWhoami({ file, origin: api.origin }),
    ]);

    expect(exitCodes).toStrictEqual([0, 0]);
    expect(api.refreshRequests).toHaveLength(1);
  });

  it("refreshes once when the API rejects the access token, then retries", async () => {
    const file = createCredentialsFile();

    const api = await startFakeApi({
      acceptedToken: "access-new",
      refresh: { body: tokenResponse("new"), status: 200 },
    });

    await saveLogin({
      file,
      login: storedLogin("revoked", Date.now() + HOUR_MS),
      origin: api.origin,
    });

    const result = await sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST });

    expect(result.status).toBe(200);
    expect(api.staffCalls).toStrictEqual(["Bearer access-revoked", "Bearer access-new"]);
    expect(api.refreshRequests).toHaveLength(1);
  });

  it("uses the pair another command saved instead of sending a rotated refresh token", async () => {
    const file = createCredentialsFile();

    const api = await startFakeApi({
      acceptedToken: "access-other",
      beforeRejecting: () =>
        saveLogin({ file, login: storedLogin("other", Date.now() + HOUR_MS), origin: api.origin }),
      refresh: { body: { error: "invalid_grant" }, status: 400 },
    });

    await saveLogin({ file, login: storedLogin("old", Date.now() + HOUR_MS), origin: api.origin });

    const result = await sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST });

    expect(result.status).toBe(200);
    expect(api.refreshRequests).toStrictEqual([]);
    expect(api.staffCalls).toStrictEqual(["Bearer access-old", "Bearer access-other"]);
  });

  it("asks for a new login and forgets the old one when the refresh token is refused", async () => {
    const file = createCredentialsFile();

    const api = await startFakeApi({
      acceptedToken: "access-new",
      refresh: { body: { error: "invalid_grant" }, status: 400 },
    });

    await saveLogin({ file, login: storedLogin("ended", Date.now() - 1000), origin: api.origin });

    await expect(
      sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST }),
    ).rejects.toMatchObject({
      exitCode: EXIT_CODES.notLoggedIn,
      message: `Not logged in to ${api.origin}. Run \`pnpm zoonk login --api ${api.origin}\`.`,
    });

    expect(api.staffCalls).toStrictEqual([]);
    expect(readLogin({ file, origin: api.origin })).toBeNull();
  });

  it("never follows a redirect with the refresh token", async () => {
    const file = createCredentialsFile();

    const elsewhere = await startFakeApi({
      acceptedToken: "access-new",
      refresh: { body: tokenResponse("new"), status: 200 },
    });

    const api = await startFakeApi({
      acceptedToken: "access-new",
      refresh: {
        body: {},
        headers: { location: `${elsewhere.origin}/v1/auth/oauth2/token` },
        status: 307,
      },
    });

    await saveLogin({ file, login: storedLogin("old", Date.now() - 1000), origin: api.origin });

    await expect(
      sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST }),
    ).rejects.toMatchObject({ exitCode: EXIT_CODES.failed });

    expect(elsewhere.refreshRequests).toStrictEqual([]);
    expect(readLogin({ file, origin: api.origin })).toMatchObject({ refreshToken: "refresh-old" });
  });

  it("refuses a refreshed token a header can't carry, without printing it", async () => {
    const file = createCredentialsFile();

    const api = await startFakeApi({
      acceptedToken: "access-new",
      refresh: {
        body: { ...tokenResponse("new"), access_token: "SECRET\r\nX-Injected: yes" },
        status: 200,
      },
    });

    await saveLogin({ file, login: storedLogin("old", Date.now() - 1000), origin: api.origin });

    const failure = await sendAuthorized({
      file,
      origin: api.origin,
      request: WHOAMI_REQUEST,
    }).then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({ exitCode: EXIT_CODES.notLoggedIn });
    expect(String(failure)).not.toContain("SECRET");
    expect(api.staffCalls).toStrictEqual([]);
    expect(readLogin({ file, origin: api.origin })).toBeNull();
  });

  it("forgets the login when a refresh's answer is lost, so the rotated token is never sent again", async () => {
    const file = createCredentialsFile();
    const api = await startFakeApi({ acceptedToken: "access-new", refresh: "lost" });

    await saveLogin({ file, login: storedLogin("old", Date.now() - 1000), origin: api.origin });

    await expect(
      sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST }),
    ).rejects.toMatchObject({
      exitCode: EXIT_CODES.notLoggedIn,
      message:
        `Couldn't confirm the login renewal with ${api.origin}. ` +
        `Run \`pnpm zoonk login --api ${api.origin}\` to log in again.`,
    });

    expect(readLogin({ file, origin: api.origin })).toBeNull();

    await expect(
      sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST }),
    ).rejects.toMatchObject({ exitCode: EXIT_CODES.notLoggedIn });

    expect(api.refreshRequests).toHaveLength(1);
    expect(api.staffCalls).toStrictEqual([]);
  });

  it("keeps the login when the API can't be reached", async () => {
    const file = createCredentialsFile();

    const api = await startFakeApi({
      acceptedToken: "access-new",
      refresh: { body: tokenResponse("new"), status: 200 },
    });

    await new Promise((resolve) => {
      servers.pop()?.close(resolve);
    });

    await saveLogin({ file, login: storedLogin("old", Date.now() - 1000), origin: api.origin });

    await expect(
      sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST }),
    ).rejects.toMatchObject({ exitCode: EXIT_CODES.failed });

    expect(readLogin({ file, origin: api.origin })).toMatchObject({ refreshToken: "refresh-old" });
  });

  it.each([
    [429, { error: "temporarily_unavailable" }],
    [503, {}],
  ])("keeps the login when a refresh fails with HTTP %i", async (status, body) => {
    const file = createCredentialsFile();
    const api = await startFakeApi({ acceptedToken: "access-new", refresh: { body, status } });

    await saveLogin({ file, login: storedLogin("old", Date.now() - 1000), origin: api.origin });

    await expect(
      sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST }),
    ).rejects.toMatchObject({ exitCode: EXIT_CODES.failed });

    expect(readLogin({ file, origin: api.origin })).toMatchObject({ refreshToken: "refresh-old" });
  });

  it.each([502, 504])("forgets the login when a refresh ends in HTTP %i", async (status) => {
    const file = createCredentialsFile();
    const api = await startFakeApi({ acceptedToken: "access-new", refresh: { body: {}, status } });

    await saveLogin({ file, login: storedLogin("old", Date.now() - 1000), origin: api.origin });

    await expect(
      sendAuthorized({ file, origin: api.origin, request: WHOAMI_REQUEST }),
    ).rejects.toMatchObject({ exitCode: EXIT_CODES.notLoggedIn });

    expect(readLogin({ file, origin: api.origin })).toBeNull();
  });
});
