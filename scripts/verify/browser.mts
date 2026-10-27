import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import {
  type Browser,
  type BrowserContextOptions,
  type CDPSession,
  type Page,
} from "@playwright/test";
import {
  describeViolations,
  resumeAnimations,
  settleAnimations,
  stillAnimations,
} from "../../packages/testing/src/accessibility/scan.ts";
import {
  TARGET_SELECTOR,
  findSmallTargets,
  sampleTargets,
} from "../../packages/testing/src/accessibility/target-size.ts";
import { type LoadMeasurement } from "./checks.mts";
import { neutralTextOnly } from "./contrast.mts";
import { installProbe, readProbe } from "./probe.mts";
import { type RequestRecord } from "./requests.mts";
import { type Scheme, THROTTLING, VIEWPORTS, type ViewportName } from "./viewports.mts";

const QUIET_MS = 1000;
const QUIET_LIMIT_MS = 10_000;
const QUIET_POLL_MS = 250;
const ANIMATION_WAIT_MS = 3000;
const ANIMATION_TRIES = 5;
const CONSOLE_TEXT_LENGTH = 500;
const FRAME_NAME_DIGITS = 5;
const SCREENCAST = { format: "jpeg", maxHeight: 1600, maxWidth: 800, quality: 60 } as const;

/**
 * axe-core's source, run through DevTools' evaluate rather than a script tag, so the page keeps its
 * own Content Security Policy while it's measured.
 */
const axeScript = readFileSync(
  createRequire(resolve(import.meta.dirname, "../../packages/testing/package.json")).resolve(
    "axe-core/axe.min.js",
  ),
  "utf8",
);

type Violations = Parameters<typeof describeViolations>[0];

/** Records every request, console message and uncaught error a page makes. */
function recordTraffic(page: Page, actions: Map<string, string>) {
  const traffic = {
    console: [] as LoadMeasurement["console"],
    inFlight: 0,
    lastRequestAt: Date.now(),
    pageErrors: [] as string[],
    requests: [] as RequestRecord[],
  };

  const records = new Map<object, RequestRecord>();

  function settle(request: object, update: Partial<RequestRecord>) {
    traffic.inFlight -= 1;
    traffic.lastRequestAt = Date.now();
    Object.assign(records.get(request) ?? {}, update);
  }

  page.on("request", (request) => {
    const headers = request.headers();

    const record = {
      action: actions.get(headers["next-action"] ?? ""),
      headers,
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
    };

    records.set(request, record);
    traffic.requests.push(record);
    traffic.inFlight += 1;
    traffic.lastRequestAt = Date.now();
  });

  page.on("response", (response) => {
    Object.assign(records.get(response.request()) ?? {}, { status: response.status() });
  });

  page.on("requestfinished", (request) => settle(request, {}));

  page.on("requestfailed", (request) =>
    settle(request, { failure: request.failure()?.errorText ?? "failed" }),
  );

  page.on("console", (message) => {
    const type = message.type();

    if (type === "error" || type === "warning") {
      traffic.console.push({ text: message.text().slice(0, CONSOLE_TEXT_LENGTH), type });
    }
  });

  page.on("pageerror", (error) => traffic.pageErrors.push(error.message));
  return traffic;
}

export type Traffic = ReturnType<typeof recordTraffic>;

/**
 * Waits until the page stops changing: no DOM changes and no requests for a second. False when it
 * was still changing at the deadline (a poll, a loop or an endless animation).
 */
export async function waitForQuiet(page: Page, traffic: Traffic): Promise<boolean> {
  const deadline = Date.now() + QUIET_LIMIT_MS;

  while (Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop -- Polls the page until it's quiet.
    const probe = await page.evaluate(readProbe);
    const domQuiet = probe ? probe.now - probe.lastMutationAt >= QUIET_MS : true;
    const networkQuiet = traffic.inFlight <= 0 && Date.now() - traffic.lastRequestAt >= QUIET_MS;

    if (domQuiet && networkQuiet) {
      return true;
    }

    // oxlint-disable-next-line no-await-in-loop -- Waits between polls.
    await page.waitForTimeout(QUIET_POLL_MS);
  }

  return false;
}

/** A fresh browser context on one screen and scheme, probed, throttled when asked, recorded. */
export async function openPage({
  actions,
  browser,
  scheme,
  storageState,
  throttle,
  viewport,
}: {
  actions: Map<string, string>;
  browser: Browser;
  scheme: Scheme;
  storageState?: BrowserContextOptions["storageState"];
  throttle: boolean;
  viewport: ViewportName;
}) {
  const context = await browser.newContext({
    ...VIEWPORTS[viewport],
    colorScheme: scheme,
    storageState,
  });

  await context.addInitScript(installProbe);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  // Thread time counts only the main thread's own work, so a busy machine barely moves it.
  await cdp.send("Performance.enable", { timeDomain: "threadTicks" });

  if (throttle) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLING.cpuRate });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", THROTTLING.network);
  }

  return { cdp, context, page, traffic: recordTraffic(page, actions) };
}

/** The CPU time the page's main thread has spent on tasks so far, in ms. */
export async function readMainThreadMs(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return (metrics.find((metric) => metric.name === "TaskDuration")?.value ?? 0) * 1000;
}

/** Lifts the throttling once a load is measured, so scans and screenshots don't crawl. */
export async function unthrottle(cdp: CDPSession) {
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  await cdp.send("Network.emulateNetworkConditions", {
    downloadThroughput: -1,
    latency: 0,
    offline: false,
    uploadThroughput: -1,
  });
}

/**
 * axe-core's serious and critical violations and targets under 44 px, by the player's scan rules:
 * on a device asking for more contrast, where the app keeps WCAG AA (its regular look is softer).
 */
async function scanAccessibility(page: Page, where: string) {
  await page.evaluate(stillAnimations);

  for (let attempt = 0; attempt < ANIMATION_TRIES; attempt += 1) {
    // oxlint-disable-next-line no-await-in-loop -- An animation can start as another ends.
    if ((await page.evaluate(settleAnimations, ANIMATION_WAIT_MS)) === 0) {
      break;
    }
  }

  if (!(await page.evaluate("Boolean(globalThis.axe)"))) {
    await page.evaluate(axeScript);
  }

  // Neutral text meets WCAG AA in the regular look too; colored marks there are soft by design.
  const regular: Violations = await page.evaluate(
    "axe.run(document, { resultTypes: ['violations'], runOnly: ['color-contrast'] }).then((results) => results.violations)",
  );

  await page.emulateMedia({ contrast: "more" });

  const violations: Violations = await page.evaluate(
    "axe.run(document, { resultTypes: ['violations'] }).then((results) => results.violations)",
  );

  const targets = findSmallTargets(await page.evaluate(sampleTargets, TARGET_SELECTOR));
  await page.evaluate(resumeAnimations);
  await page.emulateMedia({ contrast: "no-preference" });

  return {
    failing: [
      ...describeViolations(violations, where).failing,
      ...targets.map((target) => `${where}: [target-size] ${target}`),
    ],
    regular: describeViolations(neutralTextOnly(regular), where).failing,
  };
}

/** A saved paint's file name, by its time in ms, so names sort in the order they were painted. */
export function frameFile(ms: number): string {
  return `${String(ms).padStart(FRAME_NAME_DIGITS, "0")}ms.jpg`;
}

/** Saves the screencast's frames painted after the navigation started, named by their ms. */
export async function saveFrames({
  directory,
  frames,
  timeOrigin,
}: {
  directory: string;
  frames: { data: string; timestamp: number }[];
  timeOrigin: number;
}): Promise<number[]> {
  const timed = frames
    .map((frame) => ({ ...frame, ms: Math.round(frame.timestamp * 1000 - timeOrigin) }))
    .filter((frame) => frame.ms >= 0);

  await mkdir(directory, { recursive: true });

  await Promise.all(
    timed.map(async (frame) =>
      writeFile(join(directory, frameFile(frame.ms)), frame.data, "base64"),
    ),
  );

  return timed.map((frame) => frame.ms);
}

/** Keeps every frame Chrome paints until `stop`, with the time it was painted. */
export async function recordScreencast(cdp: CDPSession) {
  const frames: { data: string; timestamp: number }[] = [];

  function keep(frame: { data: string; metadata: { timestamp?: number }; sessionId: number }) {
    frames.push({ data: frame.data, timestamp: frame.metadata.timestamp ?? 0 });
    void cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => null);
  }

  cdp.on("Page.screencastFrame", keep);
  await cdp.send("Page.startScreencast", SCREENCAST);

  async function stop() {
    await cdp.send("Page.stopScreencast");
    cdp.off("Page.screencastFrame", keep);
  }

  return { frames, stop };
}

/**
 * Scans and screenshots the loaded screen in each color scheme, switched in place. The full-page
 * screenshot ends touch emulation until the next load, so it comes after the scan.
 */
export async function checkSchemes(
  page: Page,
  { name, schemes }: { name: string; schemes: Scheme[] },
) {
  const accessibility = new Set<string>();
  const regularContrast = new Set<string>();
  const screenshots: string[] = [];

  for (const colorScheme of schemes) {
    // oxlint-disable-next-line no-await-in-loop -- One scheme at a time on the same screen.
    await page.emulateMedia({ colorScheme });

    // oxlint-disable-next-line no-await-in-loop -- Scans the scheme showing now.
    const scan = await scanAccessibility(page, "axe");

    for (const finding of scan.failing) {
      accessibility.add(finding);
    }

    for (const finding of scan.regular) {
      regularContrast.add(finding);
    }

    const screenshot = `${name}-${colorScheme}.png`;
    // oxlint-disable-next-line no-await-in-loop -- Shoots the scheme showing now.
    await page.screenshot({ animations: "disabled", fullPage: true, path: screenshot });
    screenshots.push(screenshot);
  }

  return { accessibility: [...accessibility], regularContrast: [...regularContrast], screenshots };
}
