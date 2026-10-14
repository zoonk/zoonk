import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { getTestEnvironment } from "../../packages/db/src/test-environment.ts";

const STARTUP_TIMEOUT_MS = 60_000;
const STARTUP_OUTPUT_CHARACTERS = 8192;

/** Starts only this E2E checkout's prebuilt API; callers own its lifetime and shut down this exact child. */
export async function startLiveCallApi(lane: string) {
  if (process.env.CODEX_SANDBOX && process.env.CODEX_SANDBOX !== "none") {
    throw new Error("Refusing call E2E startup under the restricted sandbox.");
  }

  const isGithubCi = process.env.GITHUB_ACTIONS === "true" && process.env.CI === "true";

  if (!/^\/Users\/will\/coding\/zoonk\/zoonk-e2e-lane-[1-4]$/u.test(lane) && !isGithubCi) {
    throw new Error("Call E2E API must run in a disposable lane or GitHub Actions CI.");
  }

  if (resolve(import.meta.dirname, "../..") !== lane) {
    throw new Error("The call E2E helper and its test environment must belong to the same lane.");
  }

  const directory = resolve(lane, "apps/api");
  const require = createRequire(resolve(directory, "package.json"));

  const child = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "start", "-p", "0"],
    {
      cwd: directory,
      env: {
        ...process.env,
        ...getTestEnvironment("e2e"),
        NEXT_PUBLIC_AUTH_BASE_PATH: "/v1/auth",
        WORKFLOW_LOCAL_DATA_DIR: resolve(directory, ".next-e2e/workflow-data"),
        WORKFLOW_TARGET_WORLD: "local",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const ready = Promise.withResolvers<string>();
  const exited = Promise.withResolvers<null>();

  const timer = setTimeout(
    () => ready.reject(new Error("Lane API startup timed out")),
    STARTUP_TIMEOUT_MS,
  );

  const startup = { output: "" };

  child.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    startup.output = `${startup.output}${chunk.toString()}`.slice(-STARTUP_OUTPUT_CHARACTERS);
    const match = /Local:\s+(?<url>http:\/\/localhost:\d+)/u.exec(startup.output);

    if (match?.groups?.url && startup.output.includes("Ready in")) {
      ready.resolve(match.groups.url);
    }
  });

  child.stderr.on("data", (chunk: Buffer) => process.stderr.write(chunk));
  child.once("error", ready.reject);

  child.once("close", (code, signal) => {
    ready.reject(new Error(`Lane API exited before startup (${code ?? signal})`));
    exited.resolve(null);
  });

  try {
    const url = await ready.promise;

    return {
      close: async () => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGTERM");
        }

        await exited.promise;
      },
      url,
    };
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }

    await exited.promise;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
