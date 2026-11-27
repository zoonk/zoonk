import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, it } from "vitest";

const execute = promisify(execFile);

type Event = {
  api?: string;
  args?: string[];
  event?: string;
  port?: number;
  prepared?: string;
  provider?: string;
};

/** Runs the supervisor with its commands and services stubbed, and returns what it did in order. */
async function supervise({
  args,
  environment,
  fail = "",
}: {
  args: string[];
  environment: NodeJS.ProcessEnv;
  fail?: string;
}) {
  const root = await mkdtemp(join(tmpdir(), "zoonk-e2e-services-"));
  const directory = join(root, "scripts/e2e");
  const log = join(root, "events.jsonl");

  try {
    await Promise.all([
      mkdir(directory, { recursive: true }),
      mkdir(join(root, "scripts/dev"), { recursive: true }),
    ]);

    await writeFile(
      join(directory, "live-call-services.mts"),
      await readFile(resolve(import.meta.dirname, "live-call-services.mts")),
    );

    await writeFile(
      join(root, "scripts/dev/process.mts"),
      String.raw`
        import { appendFile } from 'node:fs/promises';
        export async function runForegroundCommand({ args, environment }) {
          await appendFile(process.env.TEST_LOG, JSON.stringify({ args, api: environment.E2E_API_URL, prepared: environment.E2E_DATA_PREPARED, provider: environment.LIVE_CALL_TEST_PROVIDER_URL }) + '\n');
          return { code: args.includes(process.env.TEST_FAIL) ? 1 : 0, signal: null };
        }
        export function applyCommandExit(result) { process.exitCode = result.code; }
      `,
    );

    await Promise.all(
      (
        [
          ["live-call-api.mts", "startLiveCallApi", "http://api.zoonk.test"],
          [
            "live-call-provider-bridge.mts",
            "startLiveCallTestProvider",
            "http://provider.zoonk.test",
          ],
        ] as const
      ).map(async ([file, name, url]) =>
        writeFile(
          join(directory, file),
          String.raw`
            import { appendFile } from 'node:fs/promises';
            export async function ${name}(options) {
              await appendFile(process.env.TEST_LOG, JSON.stringify({ event: '${name}', port: options?.port }) + '\n');
              return { url: '${url}', close: async () => appendFile(process.env.TEST_LOG, JSON.stringify({ event: '${name}.close' }) + '\n') };
            }
          `,
        ),
      ),
    );

    const exit = await execute(
      process.execPath,
      [join(directory, "live-call-services.mts"), ...args],
      {
        cwd: root,
        env: {
          ...process.env,
          CODEX_SANDBOX: "none",
          E2E_API_URL: "",
          MAIN_APP_URL: "",
          ...environment,
          TEST_FAIL: fail,
          TEST_LOG: log,
        },
      },
    ).then(
      () => 0,
      (error: unknown) => (error instanceof Error && "code" in error ? Number(error.code) : -1),
    );

    const content = await readFile(log, "utf8");

    const events = content
      .trim()
      .split("\n")
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test's own stubs write this exact event shape.
      .map((line) => JSON.parse(line) as Event);

    return { events, exit };
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

const BUILT_API_PORT = 4000;
const BUILT_API_URL = `http://localhost:${BUILT_API_PORT}`;
const SERVICES_CLOSED = ["startLiveCallApi.close", "startLiveCallTestProvider.close"];

const isBuild = (entry: Event) => entry.args?.includes("build:e2e") ?? false;
const isPlaywright = (entry: Event) => entry.args?.at(2) === "e2e";
const isApiStart = (entry: Event) => entry.event === "startLiveCallApi";

describe("Main's E2E service supervisor", () => {
  it("builds both apps for free ports, then runs Playwright against that API", async () => {
    const { events, exit } = await supervise({ args: ["e2e/plan.test.ts"], environment: {} });
    const builds = events.filter((entry) => isBuild(entry));
    const api = events.find((entry) => isApiStart(entry));
    const playwright = events.find((entry) => isPlaywright(entry));

    assert.equal(exit, 0);
    assert.equal(builds.length, 2);
    assert.equal(builds[0]?.provider, "http://provider.zoonk.test");
    assert.equal(builds[0]?.api, `http://localhost:${api?.port}`);
    assert.deepEqual(playwright?.args?.slice(3), ["e2e/plan.test.ts"]);
    assert.equal(playwright?.prepared, "true");

    assert.deepEqual(
      events.slice(-SERVICES_CLOSED.length).map((entry) => entry.event),
      SERVICES_CLOSED,
    );
  });

  it("starts nothing when a build fails", async () => {
    const { events, exit } = await supervise({ args: [], environment: {}, fail: "build:e2e" });

    assert.equal(exit, 1);

    assert.equal(
      events.some((entry) => isPlaywright(entry)),
      false,
    );

    assert.equal(
      events.some((entry) => isApiStart(entry)),
      false,
    );

    assert.equal(events.at(-1)?.event, "startLiveCallTestProvider.close");
  });

  it("runs a prebuilt suite at the addresses it was built for, preparing its own data", async () => {
    const { events, exit } = await supervise({
      args: ["--prebuilt", "--shard=1/6"],
      environment: { E2E_API_URL: BUILT_API_URL, MAIN_APP_URL: "http://localhost:3000" },
    });

    const playwright = events.find((entry) => isPlaywright(entry));

    assert.equal(exit, 0);

    assert.equal(
      events.some((entry) => isBuild(entry)),
      false,
    );

    assert.equal(events.find((entry) => isApiStart(entry))?.port, BUILT_API_PORT);
    assert.equal(playwright?.api, BUILT_API_URL);
    assert.deepEqual(playwright?.args?.slice(3), ["--shard=1/6"]);
    assert.equal(playwright?.prepared, undefined);
  });

  it("refuses a prebuilt suite that doesn't know the addresses it was built for", async () => {
    const { events, exit } = await supervise({ args: ["--prebuilt"], environment: {} });

    assert.notEqual(exit, 0);

    assert.equal(
      events.some((entry) => isPlaywright(entry)),
      false,
    );
  });
});
