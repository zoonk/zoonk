import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, it } from "vitest";

const execute = promisify(execFile);
const CLEANUP_EVENTS = -2;

type Event = {
  args?: string[];
  command?: string;
  event?: string;
  provider?: string;
  api?: string;
  auth?: string;
};

describe("Main CI performance hook in its service supervisor", () => {
  it.each([
    { enabled: "true", failure: "", passes: true },
    { enabled: "true", failure: "build", passes: false },
    { enabled: "true", failure: "gate", passes: false },
    { enabled: "false", failure: "", passes: true },
  ])("enabled=$enabled failure=$failure", async ({ enabled, failure, passes }) => {
    const root = await mkdtemp(join(tmpdir(), "zoonk-ci-hook-"));
    const directory = join(root, "scripts/e2e");
    const log = join(root, "commands.jsonl");

    try {
      await Promise.all([
        mkdir(directory, { recursive: true }),
        mkdir(join(root, "scripts/dev"), { recursive: true }),
      ]);

      await writeFile(
        join(directory, "live-call-services.mts"),
        await readFile(resolve(import.meta.dirname, "../e2e/live-call-services.mts")),
      );

      await writeFile(
        join(root, "scripts/dev/process.mts"),
        String.raw`
        import { appendFile } from 'node:fs/promises';
        export async function runForegroundCommand({args, command, environment}) {
          await appendFile(process.env.TEST_LOG, JSON.stringify({args, command, provider:environment.LIVE_CALL_TEST_PROVIDER_URL, api:environment.E2E_API_URL, auth:environment.NEXT_PUBLIC_AUTH_BASE_PATH})+'\n');
          const failed = process.env.TEST_FAIL === 'build' && command === '/usr/bin/time' || process.env.TEST_FAIL === 'gate' && args[0] === 'perf:check';
          return {code:failed ? 1 : 0, signal:null};
        }
        export function applyCommandExit(result) { process.exitCode=result.code; }
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
          export async function ${name}() { return { url:'${url}', close:async () => appendFile(process.env.TEST_LOG, JSON.stringify({event:'${name}.close'})+'\n') }; }
        `,
          ),
        ),
      );

      const invocation = execute(
        process.execPath,
        [join(directory, "live-call-services.mts"), "test-owned-spec", "--workers=2"],
        {
          cwd: root,
          env: {
            ...process.env,
            CI: "true",
            CODEX_SANDBOX: "none",
            GITHUB_ACTIONS: "true",
            MAIN_PERF_GATES: enabled,
            TEST_FAIL: failure,
            TEST_LOG: log,
          },
        },
      );

      if (passes) {
        await invocation;
      } else {
        await assert.rejects(invocation, { code: 1 });
      }

      const content = await readFile(log, "utf8");

      const records: unknown = content
        .trim()
        .split("\n")
        .map((line): unknown => JSON.parse(line));
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test's own command stub writes this exact event shape.
      const events = records as Event[];

      const builds = events.filter(
        (entry) => entry.args?.includes("main") && entry.args.includes("build:e2e"),
      );

      assert.equal(builds.length, 1);
      assert.equal(builds[0]?.command, enabled === "true" ? "/usr/bin/time" : "pnpm");
      assert.equal(builds[0]?.api, "http://api.zoonk.test");
      assert.equal(builds[0]?.provider, "http://provider.zoonk.test");
      assert.equal(events.find((entry) => entry.args?.includes("api"))?.auth, "/v1/auth");
      const gate = events.findIndex((entry) => entry.args?.[0] === "perf:check");
      const browser = events.findIndex((entry) => entry.args?.includes("e2e"));
      assert.equal(gate !== -1, enabled === "true" && failure !== "build");
      assert.equal(browser !== -1, passes);

      if (enabled === "true" && passes) {
        assert.ok(gate < browser);
      }

      assert.deepEqual(
        events.slice(CLEANUP_EVENTS).map((entry) => entry.event),
        ["startLiveCallApi.close", "startLiveCallTestProvider.close"],
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
