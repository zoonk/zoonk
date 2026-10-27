import { join } from "node:path";
import { type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import {
  type Traffic,
  checkSchemes,
  openPage,
  recordScreencast,
  saveFrames,
  unthrottle,
  waitForQuiet,
} from "./browser.mts";
import {
  type Finding,
  type LoadMeasurement,
  type NavigationMeasurement,
  judgeLoad,
  judgeNavigation,
} from "./checks.mts";
import {
  findOverflow,
  isNextDev,
  markLinkTo,
  readProbe,
  transferredBytes,
  visibleLinks,
} from "./probe.mts";
import { classifyRequest, pathOf } from "./requests.mts";
import { readCpuMs } from "./server-cpu.mts";
import { type Scheme, VIEWPORTS, type ViewportName } from "./viewports.mts";

const LOAD_TIMEOUT_MS = 60_000;
const NETWORK_IDLE_MS = 15_000;

/** Where and how a run measures: the app, who is signed in, and the run's output folder. */
export type Target = {
  actions: Map<string, string>;
  baseUrl: string;
  browser: Browser;
  out: string;
  serverPid: number | null;
  storageState?: BrowserContextOptions["storageState"];
  throttle: boolean;
};

export type LoadReport = LoadMeasurement & {
  bytes: { html: number; scripts: number; total: number };
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
  from: string;
  settleMs: number | null;
  to: string;
  viewport: ViewportName;
};

function slug(path: string): string {
  return path.replaceAll(/[^a-z0-9]+/giu, "-").replaceAll(/^-|-$/gu, "") || "home";
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
      .map((request) => new URL(request.url).pathname),
  );

  const links = await page.evaluate(visibleLinks);
  const probe = await page.evaluate(readProbe);
  const shifts = probe?.shifts ?? [];

  return {
    bytes: await page.evaluate(transferredBytes),
    fcpMs: probe?.fcp ?? null,
    lcpMs: probe?.lcp ?? null,
    overflow: await page.evaluate(findOverflow),
    production: !(await page.evaluate(isNextDev)),
    shifts,
    skeletonLastMs: probe?.skeletonFrames.at(-1) ?? null,
    skeletonSeenMs: probe?.skeletonFrames[0] ?? null,
    timeOrigin: await page.evaluate(() => performance.timeOrigin),
    unprefetchedLinks: links.filter((link) => !prefetched.has(link)),
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
    const url = new URL(path, target.baseUrl).toString();
    const response = await page.goto(url, { timeout: LOAD_TIMEOUT_MS, waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_MS }).catch(() => null);
    await waitForQuiet(page, traffic);
    const cpuAfter = target.serverPid ? readCpuMs(target.serverPid) : null;
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
      requests: traffic.requests,
      serverCpuMs: cpuBefore === null || cpuAfter === null ? null : cpuAfter - cpuBefore,
      ttfbMs: responseStart >= 0 ? responseStart : null,
    };

    return {
      ...measurement,
      bytes,
      findings: judgeLoad(measurement),
      frames: paints,
      framesDirectory: `${name}-frames`,
      path,
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

/** Opens the first path, then taps through to each next one by its link, as a learner would. */
export async function measureNavigations(
  target: Target,
  { paths, viewport }: { paths: string[]; viewport: ViewportName },
): Promise<NavigationReport[]> {
  const { context, page, traffic } = await openPage({ ...target, scheme: "light", viewport });
  const reports: NavigationReport[] = [];
  const open = (path: string) => new URL(path, target.baseUrl).toString();

  try {
    await page.goto(open(paths[0] ?? "/"), { timeout: LOAD_TIMEOUT_MS, waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_MS }).catch(() => null);
    await waitForQuiet(page, traffic);
    const production = !(await page.evaluate(isNextDev));

    for (const [index, to] of paths.slice(1).entries()) {
      const destination = pathOf(open(to));

      const seen = {
        console: traffic.console.length,
        errors: traffic.pageErrors.length,
        requests: traffic.requests.length,
      };
      // oxlint-disable-next-line no-await-in-loop -- Each tap starts where the last one ended.
      const linkFound = await page.evaluate(markLinkTo, destination);
      // oxlint-disable-next-line no-await-in-loop -- Reads the probe before this tap.
      const before = await page.evaluate(readProbe);
      const tapAt = Date.now();

      if (linkFound) {
        const link = page.locator("[data-zoonk-verify-target]").first();
        // oxlint-disable-next-line no-await-in-loop -- One tap at a time.
        await (VIEWPORTS[viewport].hasTouch ? link.tap() : link.click());

        // oxlint-disable-next-line no-await-in-loop -- Waits for this tap's page.
        await page
          .waitForURL((url) => pathOf(url) === destination, { timeout: LOAD_TIMEOUT_MS })
          .catch(() => null);
      } else {
        // oxlint-disable-next-line no-await-in-loop -- Goes on from the next page without a link.
        await page.goto(open(to), { timeout: LOAD_TIMEOUT_MS, waitUntil: "load" });
      }

      // oxlint-disable-next-line no-await-in-loop -- Waits for this page to settle.
      await waitForQuiet(page, traffic);
      // oxlint-disable-next-line no-await-in-loop -- Reads the probe after this tap.
      const after = await page.evaluate(readProbe);
      const timed = before && after && linkFound ? timeTap({ after, before, tapAt }) : null;

      const measurement: NavigationMeasurement = {
        arrived: pathOf(page.url()) === destination,
        commitMs: timed?.commitMs ?? null,
        console: traffic.console.slice(seen.console),
        fullLoad: timed?.fullLoad ?? false,
        linkFound,
        pageErrors: traffic.pageErrors.slice(seen.errors),
        production,
        requests: traffic.requests.slice(seen.requests),
        shifts: timed?.shifts ?? [],
        skeletonSeenMs: timed?.skeletonSeenMs ?? null,
      };

      reports.push({
        ...measurement,
        findings: judgeNavigation(measurement),
        from: paths[index] ?? "/",
        settleMs: timed?.settleMs ?? null,
        to,
        viewport,
      });
    }
  } finally {
    await context.close();
  }

  return reports;
}
