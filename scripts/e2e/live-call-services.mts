import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { applyCommandExit, runForegroundCommand } from "../dev/process.mts";
import { startLiveCallApi } from "./live-call-api.mts";
import { startLiveCallTestProvider } from "./live-call-provider-bridge.mts";

/** `pnpm e2e:main`, the same in CI and in any checkout with its own E2E database. */
const repository = resolve(import.meta.dirname, "../..");

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

/**
 * CI saves Turbopack's cache only from a finished build, even when a newer push cancels the run
 * (`e2e-main.yml`).
 */
async function markBuilt({ app, built }: { app: "api" | "main"; built: boolean }) {
  if (built) {
    const marker = resolve(repository, "apps", app, ".next-e2e/e2e-build-complete");
    await mkdir(dirname(marker), { recursive: true });
    await writeFile(marker, "");
  }

  return built;
}

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
  process.env.E2E_API_URL = `http://localhost:${port}`;

  const [apiBuilt, mainBuilt] = await Promise.all([
    run({
      args: ["--filter", "api", "build:e2e"],
      environment: { ...process.env, NEXT_PUBLIC_AUTH_BASE_PATH: "/v1/auth" },
    }).then(async (built) => markBuilt({ app: "api", built })),
    buildMain().then(async (built) => markBuilt({ app: "main", built })),
  ]);

  if (!apiBuilt || !mainBuilt) {
    return;
  }

  const api = await startLiveCallApi({ port, repository });

  try {
    await run({
      args: ["--filter", "main", "e2e", ...process.argv.slice(2)],
      environment: { ...process.env, E2E_DATA_PREPARED: "true" },
    });
  } finally {
    await api.close();
  }
}

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
