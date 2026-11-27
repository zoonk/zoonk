import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { applyCommandExit, runForegroundCommand } from "../dev/process.mts";
import { startLiveCallApi } from "./live-call-api.mts";
import { startLiveCallTestProvider } from "./live-call-provider-bridge.mts";

/**
 * `pnpm e2e:main`, in any checkout with its own E2E database. CI's `e2e:suite` passes `--prebuilt`:
 * its job migrated the database and restored both apps from turbo's cache first (`e2e-main.yml`).
 */
const repository = resolve(import.meta.dirname, "../..");
const prebuilt = process.argv.includes("--prebuilt");
const playwrightArgs = process.argv.slice(2).filter((arg) => arg !== "--prebuilt");

if (process.env.CODEX_SANDBOX && process.env.CODEX_SANDBOX !== "none") {
  throw new Error("Refusing Main E2E startup under the restricted sandbox.");
}

const bridge = await startLiveCallTestProvider();
process.env.LIVE_CALL_TEST_PROVIDER_URL = bridge.url;

async function run({
  args,
  environment = process.env,
}: {
  args: string[];
  environment?: NodeJS.ProcessEnv;
}): Promise<boolean> {
  const result = await runForegroundCommand({
    args,
    command: "pnpm",
    currentDirectory: repository,
    environment,
  });

  if (result.code === 0 && !result.signal) {
    return true;
  }

  applyCommandExit(result);
  return false;
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

/** Each app's build bakes in the other's address, so a prebuilt run uses the ones it was built with. */
async function getServiceUrls(): Promise<{ api: string; main: string }> {
  if (!prebuilt) {
    const [api, main] = await Promise.all([findFreePort(), findFreePort()]);
    return { api: `http://localhost:${api}`, main: `http://localhost:${main}` };
  }

  const { E2E_API_URL: api, MAIN_APP_URL: main } = process.env;

  if (!api || !main) {
    throw new Error(
      "A prebuilt run needs the E2E_API_URL and MAIN_APP_URL the apps were built with.",
    );
  }

  return { api, main };
}

async function build(): Promise<boolean> {
  const prepared =
    (await run({ args: ["--filter", "@zoonk/db", "db:generate"] })) &&
    (await run({ args: ["--filter", "@zoonk/db", "db:setup:e2e"] })) &&
    // The builds below run outside turbo, which would otherwise extract the catalogs they read.
    (await run({ args: ["--recursive", "run", "i18n:extract"] }));

  if (!prepared) {
    return false;
  }

  const built = await Promise.all([
    run({ args: ["--filter", "api", "build:e2e"] }),
    run({ args: ["--filter", "main", "build:e2e"] }),
  ]);

  return built.every(Boolean);
}

async function runMain() {
  const urls = await getServiceUrls();
  process.env.E2E_API_URL = urls.api;
  process.env.MAIN_APP_URL = urls.main;

  if (!prebuilt && !(await build())) {
    return;
  }

  const api = await startLiveCallApi({ port: Number(new URL(urls.api).port), repository });

  try {
    await run({
      args: ["--filter", "main", "e2e", ...playwrightArgs],
      // Main's build prepared the data moments before; a prebuilt run's global setup prepares it.
      environment: prebuilt ? process.env : { ...process.env, E2E_DATA_PREPARED: "true" },
    });
  } finally {
    await api.close();
  }
}

try {
  await runMain();
} finally {
  await bridge.close();
}
