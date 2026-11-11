import { mkdtempSync, rmSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { credentialsPath, readLogin } from "./credentials.ts";
import { logIn } from "./login.ts";

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn(async () => null) }));

const servers: Server[] = [];
const directories: string[] = [];

async function startFakeAuth(tokenReplies: { body: unknown; status: number }[]) {
  const server = createServer((request, response) => {
    const reply =
      request.url === "/v1/auth/device/code"
        ? {
            body: {
              device_code: "device-1",
              expires_in: 600,
              interval: 5,
              user_code: "ABCD2345",
              verification_uri: `http://127.0.0.1:${(server.address() as AddressInfo).port}/device`,
            },
            status: 200,
          }
        : (tokenReplies.shift() ?? { body: { error: "expired_token" }, status: 400 });

    response
      .writeHead(reply.status, { "content-type": "application/json" })
      .end(JSON.stringify(reply.body));
  });

  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe(logIn, () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();

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

  it("keeps polling, more slowly, when the token endpoint is rate limited", async () => {
    vi.stubEnv("SSH_CONNECTION", "test");
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const configHome = mkdtempSync(join(tmpdir(), "zoonk-cli-"));
    directories.push(configHome);
    const file = credentialsPath({ XDG_CONFIG_HOME: configHome });

    const origin = await startFakeAuth([
      { body: { message: "Too many requests. Please try again later." }, status: 429 },
      {
        body: {
          access_token: "access-1",
          expires_in: 3600,
          refresh_token: "refresh-1",
          token_type: "Bearer",
        },
        status: 200,
      },
    ]);

    await logIn({ file, origin });

    expect(vi.mocked(delay).mock.calls.map(([ms]) => ms)).toStrictEqual([5000, 10_000]);
    expect(readLogin({ file, origin })).toMatchObject({ accessToken: "access-1" });
  });
});
