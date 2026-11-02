import { createHash } from "node:crypto";
import { join } from "node:path";
import { type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import {
  type Traffic,
  checkSchemes,
  openPage,
  readMainThreadMs,
  recordScreencast,
  saveFrames,
  unthrottle,
  waitForQuiet,
} from "./browser.mts";
import { type Finding, type LoadMeasurement, judgeLoad, totalBlockingTime } from "./checks.mts";
import { measureFrames } from "./content-frames.mts";
import {
  findOverflow,
  findTruncated,
  isNextDev,
  readProbe,
  transferredBytes,
  visibleLinks,
} from "./probe.mts";
import { readStatements } from "./queries.mts";
import {
  classifyRequest,
  inlineRscCharacters,
  pathOf,
  redactQuery,
  summarizePrefetches,
} from "./requests.mts";
import { readCpuMs } from "./server-process.mts";
import { LOAD_TIMEOUT_MS } from "./tap.mts";
import { type Scheme, type ViewportName } from "./viewports.mts";

export const NETWORK_IDLE_MS = 15_000;

export type Target = {
  actions: Map<string, string>;
  queries?: string;
  baseUrl: string;
  browser: Browser;
  out: string;
  serverPid: number | null;
  storageState?: BrowserContextOptions["storageState"];
  throttle: boolean;
};

export type LoadReport = LoadMeasurement & {
  bytes: { html: number; scripts: number; total: number };
  mainThreadMs: number;
  database: { count: number; ms: number } | null;
  findings: Finding[];
  frames: number[];
  framesDirectory: string;
  path: string;
  screenshots: string[];
  viewport: ViewportName;
};

const QUERY_HASH_LENGTH = 8;

export function slug(path: string): string {
  const { search } = new URL(path, "http://slug.invalid");

  const name =
    redactQuery(path)
      .replaceAll(/[^a-z0-9]+/giu, "-")
      .replaceAll(/^-|-$/gu, "") || "home";

  const hash = createHash("sha256").update(search).digest("hex").slice(0, QUERY_HASH_LENGTH);
  return search ? `${name}-${hash}` : name;
}

/**
 * An unmeasured load first, so the measured one's server CPU is the page's steady cost rather than
 * the first request's compiling and cache filling.
 */
export async function warmUp(target: Target, path: string) {
  const context = await target.browser.newContext({ storageState: target.storageState });
  const page = await context.newPage();

  try {
    await page.goto(new URL(path, target.baseUrl).toString(), { timeout: LOAD_TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_MS }).catch(() => null);
  } finally {
    await context.close();
  }
}

async function readLoadedPage(page: Page, traffic: Traffic) {
  const prefetched = new Set(
    traffic.requests
      .filter((request) => classifyRequest(request) === "prefetch")
      .map((request) => pathOf(request.url)),
  );

  const links = await page.evaluate(visibleLinks);
  const probe = await page.evaluate(readProbe);
  const fcpMs = probe?.fcp ?? null;

  return {
    ...measureFrames(probe?.mainFrames ?? [], fcpMs),
    ...summarizePrefetches(traffic.requests, probe?.timeOrigin ?? null),
    blankSeenMs: probe?.blankFrames[0] ?? null,
    blockingMs: probe ? totalBlockingTime(probe.longTasks, fcpMs) : null,
    bytes: await page.evaluate(transferredBytes),
    fcpMs,
    lcpMs: probe?.lcp ?? null,
    overflow: await page.evaluate(findOverflow),
    production: !(await page.evaluate(isNextDev)),
    shifts: probe?.shifts ?? [],
    skeletonLastMs: probe?.skeletonFrames.at(-1) ?? null,
    skeletonSeenMs: probe?.skeletonFrames[0] ?? null,
    timeOrigin: await page.evaluate(() => performance.timeOrigin),
    truncated: await page.evaluate(findTruncated),
    unprefetchedLinks: links
      .filter((link) => !prefetched.has(link))
      .map((link) => redactQuery(link)),
  };
}

/**
 * Dark mode is `prefers-color-scheme` in CSS alone, so switching it restyles the same screen in
 * place.
 */
export async function measureLoad(
  target: Target,
  { path, schemes, viewport }: { path: string; schemes: Scheme[]; viewport: ViewportName },
): Promise<LoadReport> {
  const { cdp, context, page, traffic } = await openPage({
    ...target,
    scheme: schemes[0] ?? "light",
    viewport,
  });

  const screencast = await recordScreencast(cdp);

  try {
    const cpuBefore = target.serverPid ? readCpuMs(target.serverPid) : null;
    const workBefore = await readMainThreadMs(cdp);
    const from = Date.now();
    const url = new URL(path, target.baseUrl).toString();
    const response = await page.goto(url, { timeout: LOAD_TIMEOUT_MS, waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_MS }).catch(() => null);
    const settled = await waitForQuiet(page, traffic);
    const cpuAfter = target.serverPid ? readCpuMs(target.serverPid) : null;
    const window = { from, to: Date.now() };
    const mainThreadMs = (await readMainThreadMs(cdp)) - workBefore;
    await screencast.stop();
    const loaded = await readLoadedPage(page, traffic);
    // Chrome's in-page navigation timing can put a streamed page's first byte before the network
    // delivered it, so the time comes from the network layer.
    const responseStart = response?.request().timing().responseStart ?? -1;

    if (target.throttle) {
      await unthrottle(cdp);
    }

    const name = join(target.out, slug(path), viewport);

    const paints = await saveFrames({
      directory: `${name}-frames`,
      frames: screencast.frames,
      timeOrigin: loaded.timeOrigin,
    });

    const appearances = await checkSchemes(page, { name, schemes });

    const { bytes, timeOrigin: _, ...measured } = loaded;

    const measurement: LoadMeasurement = {
      ...measured,
      accessibility: appearances.accessibility,
      console: traffic.console,
      lastPaintMs: paints.at(-1) ?? null,
      pageErrors: traffic.pageErrors,
      regularContrast: appearances.regularContrast,
      requests: traffic.requests,
      rscBytes: inlineRscCharacters((await response?.text().catch(() => "")) ?? ""),
      serverCpuMs: cpuBefore === null || cpuAfter === null ? null : cpuAfter - cpuBefore,
      settled,
      ttfbMs: responseStart >= 0 ? responseStart : null,
    };

    const statements = target.queries ? readStatements(target.queries, window) : null;

    return {
      ...measurement,
      bytes,
      database: statements && {
        count: statements.length,
        ms: statements.reduce((total, statement) => total + statement.ms, 0),
      },
      findings: judgeLoad(measurement),
      frames: paints,
      framesDirectory: `${name}-frames`,
      mainThreadMs,
      path: redactQuery(path),
      screenshots: appearances.screenshots,
      viewport,
    };
  } finally {
    await context.close();
  }
}
