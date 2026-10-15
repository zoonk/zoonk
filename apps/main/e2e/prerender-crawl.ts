import { randomUUID } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type APIRequestContext, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { BLOG_URL } from "@zoonk/utils/url";
import { compileDevRoutes } from "../../../scripts/e2e/prerender-compile.mjs";
import { findPrerenderErrors } from "../../../scripts/e2e/prerender-errors.mjs";
import { isExpectedPrerenderRedirect } from "../../../scripts/e2e/prerender-redirects.mjs";
import { selectPrerenderShard } from "../../../scripts/e2e/prerender-shard.mjs";
import { waitForPrerenderValidation } from "../../../scripts/e2e/prerender-validation.mjs";
import { createPrerenderCrawlFixtures, drainParallel } from "./prerender-crawl-fixtures";

const ACTIVITY_ROUTE_SEGMENTS = 4;
const OK_STATUS = 200;

const repository = resolve(process.cwd(), "../..");
const isLane = /^\/Users\/will\/coding\/zoonk\/zoonk-e2e-lane-[1-4]$/u.test(repository);

if (process.env.E2E_TESTING !== "true" || (!isLane && process.env.GITHUB_ACTIONS !== "true")) {
  throw new Error("Prerender fixtures require a disposable E2E lane or GitHub CI.");
}

const baseURL = getBaseURL();
const validationLog = process.env.PRERENDER_VALIDATION_LOG;

if (!validationLog) {
  throw new Error("Prerender crawl requires its supervisor's validation log.");
}

const validationLogPath = validationLog;

const contexts: APIRequestContext[] = [];

const results: {
  locale?: string;
  location?: string;
  path: string;
  persona: string;
  seconds: number;
  status: number;
}[] = [];

const failures: string[] = [];
const started = performance.now();

/**
 * A persona can sit idle while others crawl, and Node closes an idle keep-alive socket after about
 * six seconds: a request reusing that socket as it closes fails with ECONNRESET before Next sees it.
 */
async function context(
  storageState?: NonNullable<Parameters<typeof request.newContext>[0]>["storageState"],
) {
  const result = await request.newContext({
    baseURL,
    extraHTTPHeaders: { connection: "close" },
    storageState,
    timeout: 60_000,
  });

  contexts.push(result);
  return result;
}

type Fixtures = Awaited<ReturnType<typeof createPrerenderCrawlFixtures>>;

/** The route a page file serves, e.g. `[lang]/(app)/today/page.tsx` → `/[lang]/today`. */
function routePattern(file: string) {
  return `/${file
    .split("/")
    .filter((segment) => !segment.startsWith("("))
    .slice(0, -1)
    .join("/")}`;
}

function pageCase({ file, fixtures }: { file: string; fixtures: Fixtures }) {
  const pattern = routePattern(file);
  const segments = pattern.split("/");
  const kind = segments[2];

  const special =
    segments.at(-1)?.startsWith("[") && segments.length === ACTIVITY_ROUTE_SEGMENTS
      ? Object.entries(fixtures.special).find(([name]) => name === kind)?.[1]
      : undefined;

  const parameters: Record<string, string> = { ...fixtures.parameters, ...special?.params };

  const path = pattern.replaceAll(/\[(?<parameter>[^\]]+)\]/gu, (_match, key: string) => {
    const value = parameters[key];

    if (!value) {
      throw new Error(`Missing prerender fixture for ${pattern}: ${key}`);
    }

    return encodeURIComponent(value);
  });

  return { client: special?.client ?? fixtures.examContext, path };
}

/** Compiling every route up front leaves the serial crawl only rendering and validating. */
async function compileRoutes(files: readonly string[]) {
  const start = performance.now();
  await compileDevRoutes({ baseURL, routes: files.map((file) => routePattern(file)) });

  process.stdout.write(
    `Compiled ${files.length} routes in ${((performance.now() - start) / 1000).toFixed(2)}s.\n`,
  );
}

/** Fixtures and compiles are independent; both settle before a failure triggers cleanup. */
async function prepareCrawl(files: readonly string[]) {
  const [fixtures] = await drainParallel([
    createPrerenderCrawlFixtures({ baseURL, createContext: context }),
    compileRoutes(files),
  ]);

  return fixtures;
}

async function visit({
  client,
  locale,
  path,
  persona,
}: {
  client: APIRequestContext;
  locale: string;
  path: string;
  persona: string;
}) {
  const start = performance.now();
  const requestId = randomUUID();

  try {
    const response = await client.get(path, {
      headers: { "x-nextjs-request-id": requestId },
      maxRedirects: 0,
    });

    const body = await response.text();
    const status = response.status();
    const location = response.headers().location;

    for (const error of findPrerenderErrors(body)) {
      failures.push(`${persona} ${path}: ${error.message}`);
    }

    if (
      isExpectedPrerenderRedirect({
        baseURL,
        blogURL: BLOG_URL,
        locale,
        location,
        path,
        persona,
        status,
      })
    ) {
      results.push({
        locale,
        location,
        path,
        persona,
        seconds: (performance.now() - start) / 1000,
        status,
      });

      process.stdout.write(`Prerender GET ${persona} ${path}: ${status} -> ${location}\n`);
      return;
    }

    if (status !== OK_STATUS) {
      failures.push(`${persona} ${path}: HTTP ${status}`);
    }

    results.push({ path, persona, seconds: (performance.now() - start) / 1000, status });
    process.stdout.write(`Prerender GET ${persona} ${path}: ${status}\n`);
  } catch (error) {
    failures.push(`${persona} ${path}: ${String(error)}`);
    return;
  }

  await waitForPrerenderValidation({ logPath: validationLogPath, requestId });
}

try {
  const entries = await readdir("src/app", { recursive: true });

  const files = selectPrerenderShard({
    items: entries.filter((file) => /(?:^|\/)page\.(?:tsx?|jsx?|mdx)$/u.test(file)).toSorted(),
    shard: process.env.PRERENDER_SHARD,
  });

  if (files.length === 0) {
    throw new Error("No Main page files discovered for this prerender shard.");
  }

  const fixtures = await prepareCrawl(files);

  const cases = files.map((file) => pageCase({ file, fixtures }));
  const locale = fixtures.parameters.lang;

  if (!locale) {
    throw new Error("Prerender fixtures require a locale.");
  }

  /** A route's first render read/modifies/writes Next 16.4's dev prerender manifest without a lock. */
  for (const { client, path } of cases) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Concurrent first renders corrupt Next's dev prerender-manifest.json.
    await visit({ client: fixtures.visitor, locale, path, persona: "visitor" });
    // oxlint-disable-next-line eslint/no-await-in-loop -- Finish this route before rendering another route.
    await visit({ client, locale, path, persona: "learner" });
  }
} finally {
  await Promise.all(contexts.map((client) => client.dispose()));
  await prisma.$disconnect();
  await mkdir("test-results", { recursive: true });

  await writeFile(
    "test-results/prerender-crawl.json",
    JSON.stringify({ failures, results, seconds: (performance.now() - started) / 1000 }, null, 2),
  );
}

if (failures.length > 0) {
  throw new Error(`Prerender crawl failed:\n${failures.join("\n")}`);
}

process.stdout.write(
  `Prerender crawl: ${results.length} GETs in ${((performance.now() - started) / 1000).toFixed(2)}s.\n`,
);
