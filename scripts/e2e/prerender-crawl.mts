import { spawn } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { getTestEnvironment } from "../../packages/db/src/test-environment.ts";
import { BLOG_URL } from "../../packages/utils/src/url.ts";
import { applyCommandExit, runForegroundCommand } from "../dev/process.mts";
import { startLiveCallApi } from "./live-call-api.mts";
import { findPrerenderErrors } from "./prerender-errors.mts";
import { withPrerenderCancellation } from "./prerender-lifecycle.mts";
import { hasVerifiedBlogRedirects } from "./prerender-redirects.mts";

const STARTUP_TIMEOUT_MS = 60_000;
const STARTUP_BUFFER_CHARACTERS = 8192;

const repository = process.cwd();
const isLane = /^\/Users\/will\/coding\/zoonk\/zoonk-e2e-lane-[1-4]$/u.test(repository);
const isGitHubCi = process.env.GITHUB_ACTIONS === "true" && process.env.CI === "true";

if (
  (!isLane && !isGitHubCi) ||
  resolve(import.meta.dirname, "../..") !== repository ||
  (process.env.CODEX_SANDBOX && process.env.CODEX_SANDBOX !== "none")
) {
  throw new Error(
    "Prerender validation must run outside the sandbox in its own E2E lane or GitHub CI.",
  );
}

/** CI makes the shared test loader prefer caller URLs; local lanes must use their own file. */
if (isLane && process.env.CI) {
  throw new Error(
    "Local prerender validation refuses CI overrides before any service or fixture starts.",
  );
}

/** A route regression must not spend on a model, even if it accidentally calls one during GET. */
const noAiCredentials = {
  AI_GATEWAY_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  GEMINI_API_KEY: "",
  OPENAI_API_KEY: "",
  VERCEL_OIDC_TOKEN: "",
};

const environment = { ...process.env, ...getTestEnvironment("e2e"), ...noAiCredentials };
Object.assign(process.env, environment);

async function startMainDev({ log, signal }: { log: string; signal: AbortSignal }) {
  const directory = resolve(repository, "apps/main");
  const require = createRequire(resolve(directory, "package.json"));

  /** This guard owns its disposable dev cache; never reuse a manifest from an interrupted crawl. */
  await rm(resolve(directory, ".next-e2e/dev"), { force: true, recursive: true });

  await mkdir(resolve(repository, "apps/main/test-results"), { recursive: true });
  await writeFile(log, "");
  await rm(resolve(directory, "test-results/prerender-crawl.json"), { force: true });
  signal.throwIfAborted();

  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "-p", "0"], {
    cwd: directory,
    env: {
      ...process.env,
      ...noAiCredentials,
      NEXT_TEST_LOG_VALIDATION: "1",
      PRERENDER_GUARD: "true",
      STRIPE_SECRET_KEY: "sk_test_fake",
      __NEXT_TEST_MODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const ready = Promise.withResolvers<string>();
  const exited = Promise.withResolvers<null>();
  const chunks: string[] = [];
  const startup = { ready: false, text: "" };

  const timer = setTimeout(
    () => ready.reject(new Error("Main dev startup timed out")),
    STARTUP_TIMEOUT_MS,
  );

  function capture(chunk: Buffer) {
    const output = chunk.toString();
    chunks.push(output);
    appendFileSync(log, output);
    process.stdout.write(output);

    if (!startup.ready) {
      startup.text = `${startup.text}${output}`.slice(-STARTUP_BUFFER_CHARACTERS);
      const match = /Local:\s+(?<url>http:\/\/localhost:\d+)/u.exec(startup.text);

      if (match?.groups?.url && startup.text.includes("Ready in")) {
        startup.ready = true;
        ready.resolve(match.groups.url);
      }
    }
  }

  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.once("error", ready.reject);

  child.once("close", (code, exitSignal) => {
    ready.reject(new Error(`Main dev exited before readiness (${code ?? exitSignal})`));
    exited.resolve(null);
  });

  function stop() {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  }

  signal.addEventListener("abort", stop, { once: true });

  async function close() {
    stop();
    await exited.promise;
    signal.removeEventListener("abort", stop);
    return chunks.join("");
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

/** The catalog's dedicated missing-page boundary deliberately cannot produce a page to validate. */
function isExpectedMissingBoundary(error: ReturnType<typeof findPrerenderErrors>[number]) {
  return (
    error.message.includes('Route "/[lang]/_catalog-not-found": Could not validate `instant`') &&
    error.context.includes("NEXT_HTTP_ERROR_FALLBACK;404")
  );
}

async function reportPrerenderResult({
  baseURL,
  log,
  output,
  started,
}: {
  baseURL: string;
  log: string;
  output: string;
  started: number;
}) {
  const path = resolve(repository, "apps/main/test-results/prerender-crawl.json");
  const result: unknown = existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : null;
  const blogRedirectsVerified = hasVerifiedBlogRedirects({ baseURL, blogURL: BLOG_URL, result });

  function isUnexpected(error: ReturnType<typeof findPrerenderErrors>[number]) {
    if (isExpectedMissingBoundary(error)) {
      return false;
    }

    return !(
      blogRedirectsVerified &&
      error.message.includes('Route "/[lang]/blog" did not produce a static shell')
    );
  }

  const failures = findPrerenderErrors(output).filter((error) => isUnexpected(error));

  process.stdout.write(
    `Dev prerender guard: ${((performance.now() - started) / 1000).toFixed(2)}s; ${failures.length} validation errors. Log: ${log}\n`,
  );

  if (failures.length > 0) {
    for (const failure of failures) {
      process.stderr.write(`${failure.context}\n`);
    }

    process.exitCode = 1;
  }
}

await withPrerenderCancellation(async (signal) => {
  const environmentPath = resolve(repository, "packages/db/.env.e2e.local");
  const previousEnvironment = isLane ? await readFile(environmentPath, "utf8") : null;
  const started = performance.now();
  signal.throwIfAborted();
  const api = await startLiveCallApi(repository);

  try {
    signal.throwIfAborted();
    process.env.NEXT_PUBLIC_API_URL = api.url;

    if (previousEnvironment !== null) {
      const content = previousEnvironment.replaceAll(
        /^[\t ]*(?:export[\t ]+)?NEXT_PUBLIC_API_URL[\t ]*=.*\r?\n?/gmu,
        "",
      );

      await writeFile(environmentPath, `${content.trimEnd()}\nNEXT_PUBLIC_API_URL=${api.url}\n`);
    }

    const log = resolve(repository, "apps/main/test-results/prerender-crawl.log");
    signal.throwIfAborted();
    const dev = await startMainDev({ log, signal });
    const output = { text: "" };

    try {
      signal.throwIfAborted();

      applyCommandExit(
        await runForegroundCommand({
          args: ["--filter", "main", "e2e:prerender"],
          command: "pnpm",
          currentDirectory: repository,
          environment: {
            ...process.env,
            E2E_BASE_URL: dev.url,
            PRERENDER_VALIDATION_LOG: log,
            ...noAiCredentials,
          },
        }),
      );
    } finally {
      output.text = await dev.close();
      await mkdir(resolve(repository, "apps/main/test-results"), { recursive: true });
      await writeFile(log, output.text);
    }

    await reportPrerenderResult({ baseURL: dev.url, log, output: output.text, started });
  } finally {
    try {
      if (previousEnvironment !== null) {
        await writeFile(environmentPath, previousEnvironment);
      }
    } finally {
      await api.close();
    }
  }
});
