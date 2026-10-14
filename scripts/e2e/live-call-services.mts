import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyCommandExit, runForegroundCommand } from "../dev/process.mts";
import { startLiveCallApi } from "./live-call-api.mts";
import { startLiveCallTestProvider } from "./live-call-provider-bridge.mts";

/** Supervises Main's real API and no-spend provider for the canonical CI call flow. */
const repository = process.cwd();
const isLane = /^\/Users\/will\/coding\/zoonk\/zoonk-e2e-lane-[1-4]$/u.test(repository);
const isGitHubCi = process.env.GITHUB_ACTIONS === "true" && process.env.CI === "true";

if (process.env.CODEX_SANDBOX && process.env.CODEX_SANDBOX !== "none") {
  throw new Error("Refusing Main E2E startup under the restricted sandbox.");
}

if (!isLane && !isGitHubCi) {
  throw new Error("Main E2E must run in a disposable lane or GitHub CI.");
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

async function runMain() {
  if (!(await run({ args: ["--filter", "@zoonk/db", "db:generate"] }))) {
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

  const environmentPath = resolve(repository, "packages/db/.env.e2e.local");
  const previousEnvironment = isLane ? await readFile(environmentPath, "utf8") : null;
  const api = await startLiveCallApi(repository);

  try {
    process.env.NEXT_PUBLIC_API_URL = api.url;

    // Local test launchers deliberately take URLs from the lane's file rather than caller env.
    if (previousEnvironment !== null) {
      const content = previousEnvironment.replaceAll(
        /^[\t ]*(?:export[\t ]+)?NEXT_PUBLIC_API_URL[\t ]*=.*\r?\n?/gmu,
        "",
      );

      await writeFile(environmentPath, `${content.trimEnd()}\nNEXT_PUBLIC_API_URL=${api.url}\n`);
    }

    if (!(await run({ args: ["--filter", "main", "build:e2e"] }))) {
      return;
    }

    await run({ args: ["--filter", "main", "e2e", ...process.argv.slice(2)] });
  } finally {
    try {
      if (previousEnvironment !== null) {
        await writeFile(environmentPath, previousEnvironment);
      }
    } finally {
      await api.close();
    }
  }
}

try {
  await runMain();
} finally {
  await bridge.close();
}
