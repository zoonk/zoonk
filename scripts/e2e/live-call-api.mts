import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { getTestEnvironment } from "../../packages/db/src/test-environment.ts";
import { stopChildProcess } from "./stop-child-process.mts";

const STARTUP_TIMEOUT_MS = 60_000;
const STARTUP_OUTPUT_CHARACTERS = 8192;

/**
 * Starts only this checkout's prebuilt E2E API on `port`; callers own its lifetime and shut down
 * this exact child.
 */
export async function startLiveCallApi({ port, repository }: { port: number; repository: string }) {
  if (process.env.CODEX_SANDBOX && process.env.CODEX_SANDBOX !== "none") {
    throw new Error("Refusing call E2E startup under the restricted sandbox.");
  }

  if (resolve(import.meta.dirname, "../..") !== repository) {
    throw new Error(
      "The call E2E helper and its test environment must belong to the same checkout.",
    );
  }

  const directory = resolve(repository, "apps/api");
  const require = createRequire(resolve(directory, "package.json"));

  const child = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "start", "-p", String(port)],
    {
      cwd: directory,
      env: { ...process.env, ...getTestEnvironment("e2e"), NEXT_PUBLIC_AUTH_BASE_PATH: "/v1/auth" },
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

  function close() {
    return stopChildProcess({ child, exited: exited.promise, name: "E2E API" });
  }

  try {
    return { close, url: await ready.promise };
  } catch (error) {
    await close();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
