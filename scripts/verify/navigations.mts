import { join } from "node:path";
import { type Page } from "@playwright/test";
import { openPage, recordScreencast, saveFrames, waitForQuiet } from "./browser.mts";
import { type Finding } from "./checks.mts";
import { contentFrameAt, countFlashes } from "./content-frames.mts";
import { NETWORK_IDLE_MS, type Target, slug } from "./measure.mts";
import {
  type NavigationMeasurement,
  type NavigationMode,
  judgeNavigation,
} from "./navigation-checks.mts";
import { isNextDev, readProbe } from "./probe.mts";
import { type RequestRecord, classifyRequest, pathOf, redactQuery } from "./requests.mts";
import { LOAD_TIMEOUT_MS, tapTo } from "./tap.mts";
import { type ViewportName } from "./viewports.mts";

export type NavigationReport = NavigationMeasurement & {
  findings: Finding[];
  frames: number[];
  framesDirectory: string;
  from: string;
  settleMs: number | null;
  to: string;
  viewport: ViewportName;
};

type Probe = NonNullable<Awaited<ReturnType<typeof readProbe>>>;

/**
 * In ms since the epoch, so a tap that loaded a whole new document (whose probe started over) is
 * timed too.
 */
function timeTap({ after, before, tapAt }: { after: Probe; before: Probe; tapAt: number }) {
  const fullLoad = after.timeOrigin !== before.timeOrigin;
  const pageClick = fullLoad ? undefined : after.clicks[before.clicks.length];
  const clickAt = pageClick === undefined ? tapAt : before.timeOrigin + pageClick;
  const fromClick = (at: number) => after.timeOrigin + at >= clickAt;

  const since = (at: number | null | undefined) =>
    at === null || at === undefined ? null : after.timeOrigin + at - clickAt;

  const url = after.urls.find((entry) => fromClick(entry.at));
  const commitAt = fullLoad ? after.fcp : (url?.at ?? null);
  // The link showing it waits is the tap's answer too, before the page is there.
  const pendingAt = fullLoad ? undefined : after.pendingFrames.find((at) => fromClick(at));
  const answers = [since(commitAt), since(pendingAt)].filter((at) => at !== null);

  return {
    blankSeenMs: since(after.blankFrames.find((at) => fromClick(at))),
    clickAt,
    commitMs: since(commitAt),
    contentMs: commitAt === null ? null : since(contentFrameAt(after.mainFrames, commitAt)),
    flashes: commitAt === null ? 0 : countFlashes(after.mainFrames, commitAt),
    fullLoad,
    responseMs: answers.length > 0 ? Math.min(...answers) : null,
    settleMs: since(after.lastMutationAt),
    shifts: fullLoad ? after.shifts : after.shifts.slice(before.shifts.length),
    skeletonSeenMs: since(after.skeletonFrames.find((at) => fromClick(at))),
  };
}

const UNTIMED: Omit<ReturnType<typeof timeTap>, "clickAt"> & { clickAt: null } = {
  blankSeenMs: null,
  clickAt: null,
  commitMs: null,
  contentMs: null,
  flashes: 0,
  fullLoad: false,
  responseMs: null,
  settleMs: null,
  shifts: [],
  skeletonSeenMs: null,
};

type Opened = Awaited<ReturnType<typeof openPage>>;

function servedFromPrefetch({
  clickAt,
  contentMs,
  requests,
  to,
}: {
  clickAt: number;
  contentMs: number | null;
  requests: RequestRecord[];
  to: string;
}): boolean {
  const destination = pathOf(to);

  return !requests.some(
    (request) =>
      ["document", "navigation"].includes(classifyRequest(request)) &&
      pathOf(request.url) === destination &&
      (contentMs === null || (request.at ?? clickAt) <= clickAt + contentMs),
  );
}

async function measureTap(
  target: Target,
  {
    from,
    mode,
    name,
    opened,
    production,
    to,
    viewport,
  }: {
    from: string;
    mode: NavigationMode;
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
  const timed = before && after && linkFound ? timeTap({ after, before, tapAt }) : UNTIMED;
  const framesDirectory = join(target.out, "navigations", `${viewport}-${mode}-${name}-frames`);
  const requests = traffic.requests.slice(seen.requests);
  const { clickAt, settleMs, ...timing } = timed;

  const measurement: NavigationMeasurement = {
    ...timing,
    arrived: pathOf(page.url()) === pathOf(new URL(to, target.baseUrl)),
    console: traffic.console.slice(seen.console),
    linkFound,
    mode,
    pageErrors: traffic.pageErrors.slice(seen.errors),
    production,
    requests,
    settled,
    usedPrefetch: servedFromPrefetch({
      clickAt: clickAt ?? tapAt,
      contentMs: timing.contentMs,
      requests,
      to: new URL(to, target.baseUrl).toString(),
    }),
  };

  return {
    ...measurement,
    findings: judgeNavigation(measurement),
    frames: await saveFrames({
      directory: framesDirectory,
      frames: screencast.frames,
      timeOrigin: tapAt,
    }),
    framesDirectory,
    from: redactQuery(from),
    settleMs,
    to: redactQuery(to),
    viewport,
  };
}

function hops(paths: string[]) {
  return paths.slice(1).map((to, index) => {
    const from = paths[index] ?? "/";
    return { from, name: `${slug(from)}-to-${slug(to)}`, to };
  });
}

async function blockPrefetches(
  page: Page,
  { baseUrl, paths }: { baseUrl: string; paths: string[] },
) {
  const blocked = new Set(paths.map((path) => pathOf(new URL(path, baseUrl))));

  await page.route(
    (url) => blocked.has(pathOf(url.toString())),
    async (route) =>
      route.request().headers()["next-router-prefetch"] ? route.abort() : route.fallback(),
  );
}

async function waitForContent(page: Page) {
  await page.waitForFunction(
    () => {
      const frame = globalThis.zoonkVerify?.mainFrames.at(-1);
      return frame !== undefined && frame.words > 0 && !frame.skeleton;
    },
    undefined,
    { polling: 20, timeout: LOAD_TIMEOUT_MS },
  );
}

async function measureEarlyTaps(
  target: Target,
  { paths, viewport }: { paths: string[]; viewport: ViewportName },
): Promise<NavigationReport[]> {
  const reports: NavigationReport[] = [];

  for (const hop of hops(paths)) {
    // oxlint-disable-next-line no-await-in-loop -- Each tap starts from its own cold load.
    const opened = await openPage({ ...target, scheme: "light", viewport });

    try {
      // oxlint-disable-next-line no-await-in-loop -- The tap waits for this load.
      await opened.page.goto(new URL(hop.from, target.baseUrl).toString(), {
        timeout: LOAD_TIMEOUT_MS,
        waitUntil: "commit",
      });

      // oxlint-disable-next-line no-await-in-loop -- The tap waits for the content.
      await waitForContent(opened.page);
      // oxlint-disable-next-line no-await-in-loop -- Read once the page is there.
      const production = !(await opened.page.evaluate(isNextDev));

      reports.push(
        // oxlint-disable-next-line no-await-in-loop -- One tap at a time.
        await measureTap(target, { ...hop, mode: "early", opened, production, viewport }),
      );
    } finally {
      // oxlint-disable-next-line no-await-in-loop -- Closed before the next cold load.
      await opened.context.close();
    }
  }

  return reports;
}

export async function measureNavigations(
  target: Target,
  { mode, paths, viewport }: { mode: NavigationMode; paths: string[]; viewport: ViewportName },
): Promise<NavigationReport[]> {
  if (mode === "early") {
    return measureEarlyTaps(target, { paths, viewport });
  }

  const opened = await openPage({ ...target, scheme: "light", viewport });
  const { context, page, traffic } = opened;
  const reports: NavigationReport[] = [];

  try {
    if (mode === "noPrefetch") {
      await blockPrefetches(page, { baseUrl: target.baseUrl, paths: paths.slice(1) });
    }

    await page.goto(new URL(paths[0] ?? "/", target.baseUrl).toString(), {
      timeout: LOAD_TIMEOUT_MS,
      waitUntil: "load",
    });

    await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_MS }).catch(() => null);
    await waitForQuiet(page, traffic);
    const production = !(await page.evaluate(isNextDev));

    for (const hop of hops(paths)) {
      // oxlint-disable-next-line no-await-in-loop -- Each tap starts where the last one ended.
      reports.push(await measureTap(target, { ...hop, mode, opened, production, viewport }));
    }
  } finally {
    await context.close();
  }

  return reports;
}
