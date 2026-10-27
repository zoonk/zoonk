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
import { type NavigationMeasurement, judgeNavigation } from "./navigation-checks.mts";
import {
  findOverflow,
  findTruncated,
  isNextDev,
  readProbe,
  transferredBytes,
  visibleLinks,
} from "./probe.mts";
import { readStatements } from "./queries.mts";
import { classifyRequest, pathOf, redactQuery } from "./requests.mts";
import { readCpuMs } from "./server-process.mts";
import { LOAD_TIMEOUT_MS, tapTo } from "./tap.mts";
import { type Scheme, type ViewportName } from "./viewports.mts";

const NETWORK_IDLE_MS = 15_000;

/** Where and how a run measures: the app, who is signed in, and the run's output folder. */
export type Target = {
  actions: Map<string, string>;
  /** The `ZOONK_QUERY_LOG` file the server writes, when it logs its statements. */
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
  /** CPU time the page's main thread spent during the load, from DevTools' thread clock. */
  mainThreadMs: number;
  /** Statements the server sent during the load, its prefetches included, and their time. */
  database: { count: number; ms: number } | null;
  findings: Finding[];
  frames: number[];
  framesDirectory: string;
  path: string;
  /** A full-page screenshot in each color scheme. */
  screenshots: string[];
  viewport: ViewportName;
};

export type NavigationReport = NavigationMeasurement & {
  findings: Finding[];
  /** Paints after the tap, in ms since it, saved in `framesDirectory`. */
  frames: number[];
  framesDirectory: string;
  from: string;
  settleMs: number | null;
  to: string;
  viewport: ViewportName;
};

const QUERY_HASH_LENGTH = 8;

/** A file name for a path: its redacted form, plus a hash of its query so two queries don't collide. */
function slug(path: string): string {
  const { search } = new URL(path, "http://slug.invalid");

  const name =
    redactQuery(path)
      .replaceAll(/[^a-z0-9]+/giu, "-")
      .replaceAll(/^-|-$/gu, "") || "home";

  const hash = createHash("sha256").update(search).digest("hex").slice(0, QUERY_HASH_LENGTH);
  return search ? `${name}-${hash}` : name;
}

/**
 * Loads `path` once without measuring it, so the server CPU a measured load reports is the page's
 * steady cost rather than the first request's compiling and cache filling.
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

/** What the loaded page shows and holds, read once it has settled. */
async function readLoadedPage(page: Page, traffic: Traffic) {
  const prefetched = new Set(
    traffic.requests
      .filter((request) => classifyRequest(request) === "prefetch")
      .map((request) => pathOf(request.url)),
  );

  const links = await page.evaluate(visibleLinks);
  const probe = await page.evaluate(readProbe);
  const shifts = probe?.shifts ?? [];

  return {
    blockingMs: probe ? totalBlockingTime(probe.longTasks, probe.fcp) : null,
    bytes: await page.evaluate(transferredBytes),
    fcpMs: probe?.fcp ?? null,
    lcpMs: probe?.lcp ?? null,
    overflow: await page.evaluate(findOverflow),
    production: !(await page.evaluate(isNextDev)),
    shifts,
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
 * Loads `path` fresh on one screen in the first color scheme and measures everything the checks
 * judge, then scans and screenshots it in each scheme. Dark mode is the device's
 * `prefers-color-scheme` in CSS alone, so switching it restyles the same screen in place.
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

type Probe = NonNullable<Awaited<ReturnType<typeof readProbe>>>;

/**
 * Times one tap from the probe read before it and after the next page settled, in ms since the
 * epoch, so a tap that loaded a whole new document (whose probe started over) is timed too.
 */
function timeTap({ after, before, tapAt }: { after: Probe; before: Probe; tapAt: number }) {
  const fullLoad = after.timeOrigin !== before.timeOrigin;
  const pageClick = fullLoad ? undefined : after.clicks[before.clicks.length];
  const clickAt = pageClick === undefined ? tapAt : before.timeOrigin + pageClick;

  const since = (at: number | null | undefined) =>
    at === null || at === undefined ? null : after.timeOrigin + at - clickAt;

  const url = after.urls.find((entry) => after.timeOrigin + entry.at >= clickAt);

  return {
    commitMs: since(fullLoad ? after.fcp : url?.at),
    fullLoad,
    settleMs: since(after.lastMutationAt),
    shifts: fullLoad ? after.shifts : after.shifts.slice(before.shifts.length),
    skeletonSeenMs: since(after.skeletonFrames.find((at) => after.timeOrigin + at >= clickAt)),
  };
}

type Opened = Awaited<ReturnType<typeof openPage>>;

/** One tap from the page showing now to `to`: what it did, what it painted, and how it judged. */
async function measureTap(
  target: Target,
  {
    from,
    name,
    opened,
    production,
    to,
    viewport,
  }: {
    from: string;
    name: string;
    opened: Opened;
    production: boolean;
    to: string;
    viewport: ViewportName;
  },
): Promise<NavigationReport> {
  const { cdp, page, traffic } = opened;

  const seen = {
    console: traffic.console.length,
    errors: traffic.pageErrors.length,
    requests: traffic.requests.length,
  };

  const before = await page.evaluate(readProbe);
  const screencast = await recordScreencast(cdp);
  const tapAt = Date.now();
  const linkFound = await tapTo({ baseUrl: target.baseUrl, page, to, viewport });
  const settled = await waitForQuiet(page, traffic);
  await screencast.stop();
  const after = await page.evaluate(readProbe);
  const timed = before && after && linkFound ? timeTap({ after, before, tapAt }) : null;
  const framesDirectory = join(target.out, "navigations", `${viewport}-${name}-frames`);

  const measurement: NavigationMeasurement = {
    arrived: pathOf(page.url()) === pathOf(new URL(to, target.baseUrl)),
    commitMs: timed?.commitMs ?? null,
    console: traffic.console.slice(seen.console),
    fullLoad: timed?.fullLoad ?? false,
    linkFound,
    pageErrors: traffic.pageErrors.slice(seen.errors),
    production,
    requests: traffic.requests.slice(seen.requests),
    settled,
    shifts: timed?.shifts ?? [],
    skeletonSeenMs: timed?.skeletonSeenMs ?? null,
  };

  return {
    ...measurement,
    findings: judgeNavigation(measurement),
    // Named by ms since the tap, so the sheet shows what the learner saw after tapping.
    frames: await saveFrames({
      directory: framesDirectory,
      frames: screencast.frames,
      timeOrigin: tapAt,
    }),
    framesDirectory,
    from: redactQuery(from),
    settleMs: timed?.settleMs ?? null,
    to: redactQuery(to),
    viewport,
  };
}

/** Opens the first path, then taps through to each next one by its link, as a learner would. */
export async function measureNavigations(
  target: Target,
  { paths, viewport }: { paths: string[]; viewport: ViewportName },
): Promise<NavigationReport[]> {
  const opened = await openPage({ ...target, scheme: "light", viewport });
  const { context, page, traffic } = opened;
  const reports: NavigationReport[] = [];

  try {
    await page.goto(new URL(paths[0] ?? "/", target.baseUrl).toString(), {
      timeout: LOAD_TIMEOUT_MS,
      waitUntil: "load",
    });

    await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_MS }).catch(() => null);
    await waitForQuiet(page, traffic);
    const production = !(await page.evaluate(isNextDev));

    for (const [index, to] of paths.slice(1).entries()) {
      const from = paths[index] ?? "/";
      const name = `${slug(from)}-to-${slug(to)}`;
      // oxlint-disable-next-line no-await-in-loop -- Each tap starts where the last one ended.
      reports.push(await measureTap(target, { from, name, opened, production, to, viewport }));
    }
  } finally {
    await context.close();
  }

  return reports;
}
