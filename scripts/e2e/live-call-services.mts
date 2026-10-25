import { resolve } from "node:path";
import { applyCommandExit, runForegroundCommand } from "../dev/process.mts";
import { startLiveCallApi } from "./live-call-api.mts";
import { startLiveCallTestProvider } from "./live-call-provider-bridge.mts";

/**
 * Main's E2E run (`pnpm e2e:main`), the same in CI and in any checkout with its own E2E database:
 * migrates that database, builds and starts the real API and a no-spend live-call provider, builds
 * Main against them, and runs Main's Playwright suite with the arguments it was given.
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

async function runMain() {
  if (!(await run({ args: ["--filter", "@zoonk/db", "db:generate"] }))) {
    return;
  }

  if (!(await run({ args: ["--filter", "@zoonk/db", "db:setup:e2e"] }))) {
    return;
  }

  if (
    !(await run({
      args: ["--filter", "api", "build:e2e"],
      environment: { ...process.env, NEXT_PUBLIC_AUTH_BASE_PATH: "/v1/auth" },
    }))
  ) {
    return;
  }

  const api = await startLiveCallApi(repository);

  try {
    // The test environment (`getTestEnvironment`) points Main's build and server at this API.
    process.env.E2E_API_URL = api.url;

    if (!(await buildMain())) {
      return;
    }

    await run({ args: ["--filter", "main", "e2e", ...process.argv.slice(2)] });
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
