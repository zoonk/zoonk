import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { applyCommandExit, runForegroundCommand } from "../dev/process.mts";
import { startLiveCallApi } from "./live-call-api.mts";
import { startLiveCallTestProvider } from "./live-call-provider-bridge.mts";
import { dealShardTests, takeShardArgument } from "./shard-test-list.mts";

/**
 * Main's E2E run (`pnpm e2e:main`), the same in CI and in any checkout with its own E2E database:
 * migrates that database, builds the real API and Main side by side, starts the API and a no-spend
 * live-call provider, and runs Main's Playwright suite with the arguments it was given; a shard
 * (`--shard=2/12`) runs its share of the suite dealt test by test (`dealShardTests`).
 */
const repository = process.cwd();

if (process.env.CODEX_SANDBOX && process.env.CODEX_SANDBOX !== "none") {
  throw new Error("Refusing Main E2E startup under the restricted sandbox.");
}

const bridge = await startLiveCallTestProvider();
process.env.LIVE_CALL_TEST_PROVIDER_URL = bridge.url;

async function run({
  args,
  command = "pnpm",
  environment = process.env,
}: {
  args: string[];
  command?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<boolean> {
  const result = await runForegroundCommand({
    args,
    command,
    currentDirectory: repository,
    environment,
  });

  if (result.code === 0 && !result.signal) {
    return true;
  }

  applyCommandExit(result);
  return false;
}

const execute = promisify(execFile);

/** Room for `playwright test --list`, a line per test. */
const MAX_LISTING_BYTES = 10 * 1024 * 1024;

/**
 * The run's Playwright arguments, with a shard's tests named in a test list instead of
 * Playwright's `--shard`, which cuts the suite into contiguous runs.
 */
async function getPlaywrightArgs(args: readonly string[]): Promise<string[]> {
  const { rest, shard } = takeShardArgument(args);

  if (!shard) {
    return rest;
  }

  const { stdout } = await execute(
    process.execPath,
    [
      resolve(repository, "scripts/run-test-env.mts"),
      "e2e",
      "playwright",
      "test",
      "--list",
      ...rest,
    ],
    { cwd: resolve(repository, "apps/main"), maxBuffer: MAX_LISTING_BYTES },
  );

  const file = join(await mkdtemp(join(tmpdir(), "zoonk-e2e-shard-")), "tests.txt");
  await writeFile(file, dealShardTests({ listing: stdout, shard }));

  return [...rest, "--test-list", file];
}

/** A free local port, so Main builds against the API's address while the API builds. */
async function findFreePort(): Promise<number> {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");

  if (!address || typeof address === "string") {
    throw new Error("No free port for the E2E API.");
  }

  return address.port;
}

async function runMain() {
  if (!(await run({ args: ["--filter", "@zoonk/db", "db:generate"] }))) {
    return;
  }

  if (!(await run({ args: ["--filter", "@zoonk/db", "db:setup:e2e"] }))) {
    return;
  }

  const port = await findFreePort();
  // The test environment (`getTestEnvironment`) points Main's build and server at this API.
  process.env.E2E_API_URL = `http://localhost:${port}`;

  const [apiBuilt, mainBuilt, playwrightArgs] = await Promise.all([
    run({
      args: ["--filter", "api", "build:e2e"],
      environment: { ...process.env, NEXT_PUBLIC_AUTH_BASE_PATH: "/v1/auth" },
    }),
    buildMain(),
    getPlaywrightArgs(process.argv.slice(2)),
  ]);

  if (!apiBuilt || !mainBuilt) {
    return;
  }

  const api = await startLiveCallApi({ port, repository });

  try {
    await run({ args: ["--filter", "main", "e2e", ...playwrightArgs] });
  } finally {
    await api.close();
  }
}

/** CI measures the same build it tests, then gates its artifacts before opening the browser. */
async function buildMain(): Promise<boolean> {
  if (process.env.MAIN_PERF_GATES !== "true") {
    return run({ args: ["--filter", "main", "build:e2e"] });
  }

  const metrics = resolve(repository, "apps/main/.next-e2e-build-time.txt");

  const built = await run({
    args: ["-v", "-o", metrics, "pnpm", "--filter", "main", "build:e2e"],
    command: "/usr/bin/time",
  });

  await run({ args: ["perf:build-metrics", "--metrics", metrics] });

  return built && run({ args: ["perf:check"] });
}

try {
  await runMain();
} finally {
  await bridge.close();
}
