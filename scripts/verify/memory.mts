import { type CDPSession } from "@playwright/test";
import { openPage, waitForQuiet } from "./browser.mts";
import { type Finding } from "./checks.mts";
import { type Target } from "./measure.mts";
import { isNextDev } from "./probe.mts";
import { redactQuery } from "./requests.mts";
import { readRssMb } from "./server-process.mts";
import { LOAD_TIMEOUT_MS, tapTo } from "./tap.mts";

const BYTES_PER_MB = 1024 * 1024;

export type MemorySample = {
  documents: number;
  heapMb: number;
  listeners: number;
  nodes: number;
  serverRssMb: number | null;
};

export type SoakReport = {
  laps: number;
  paths: string[];
  /** Memory is judged only on a production build: dev tooling and on-demand compiling grow it. */
  production: boolean;
  /** The tab kept one document through every lap; a reload resets the browser's memory. */
  sameDocument: boolean;
  samples: MemorySample[];
};

/** Caches fill in the first laps and level off; a leak keeps growing. */
const LEAK_PER_LAP = { heapMb: 1, listeners: 20, nodes: 200, serverRssMb: 5 };

async function sample(cdp: CDPSession, serverPid: number | null): Promise<MemorySample> {
  // A second pass frees what the first one's finalizers released.
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.collectGarbage");
  const { metrics } = await cdp.send("Performance.getMetrics");
  const value = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? 0;

  return {
    documents: value("Documents"),
    heapMb: value("JSHeapUsedSize") / BYTES_PER_MB,
    listeners: value("JSEventListeners"),
    nodes: value("Nodes"),
    serverRssMb: serverPid ? readRssMb(serverPid) : null,
  };
}

export async function measureSoak(
  target: Target,
  { laps, paths }: { laps: number; paths: string[] },
): Promise<SoakReport> {
  const { cdp, context, page, traffic } = await openPage({
    ...target,
    scheme: "light",
    throttle: false,
    viewport: "laptop",
  });

  const [start = "/"] = paths;
  const lap = [...paths.slice(1), start];
  const samples: MemorySample[] = [];
  const state = { production: false, sameDocument: false, startedAt: 0 };

  try {
    await page.goto(new URL(start, target.baseUrl).toString(), { timeout: LOAD_TIMEOUT_MS });
    await waitForQuiet(page, traffic);
    state.production = !(await page.evaluate(isNextDev));
    state.startedAt = await page.evaluate(() => performance.timeOrigin);

    for (let round = 1; round <= laps; round += 1) {
      for (const to of paths.length > 1 ? lap : []) {
        // oxlint-disable-next-line no-await-in-loop -- Each tap starts where the last one ended.
        await tapTo({ baseUrl: target.baseUrl, page, to, viewport: "laptop" });
        // oxlint-disable-next-line no-await-in-loop -- Lets the page settle before the next tap.
        await waitForQuiet(page, traffic);
      }

      if (paths.length === 1) {
        // oxlint-disable-next-line no-await-in-loop -- One reload per lap.
        await page.reload({ timeout: LOAD_TIMEOUT_MS });
        // oxlint-disable-next-line no-await-in-loop -- Lets the page settle before the next lap.
        await waitForQuiet(page, traffic);
      }

      // oxlint-disable-next-line no-await-in-loop -- Samples after every lap.
      samples.push(await sample(cdp, target.serverPid));
    }
    // A path with no link to the next one is loaded instead, which replaces the document.
    state.sameDocument = (await page.evaluate(() => performance.timeOrigin)) === state.startedAt;
  } finally {
    await context.close();
  }

  return {
    laps,
    paths: paths.map((path) => redactQuery(path)),
    production: state.production,
    sameDocument: paths.length > 1 && state.sameDocument,
    samples,
  };
}

const middle = (laps: number) => Math.ceil(laps / 2);

function lateGrowth(samples: MemorySample[], key: keyof MemorySample): number {
  const from = samples[middle(samples.length) - 1]?.[key];
  const to = samples.at(-1)?.[key];
  const laps = samples.length - middle(samples.length);

  return from === null || from === undefined || to === null || to === undefined || laps === 0
    ? 0
    : (to - from) / laps;
}

/** The browser's growth counts only when the tab kept one document; the server's always does. */
export function judgeSoak({ production, sameDocument, samples }: SoakReport): Finding[] {
  if (samples.length < 2 || !production) {
    return [];
  }

  const growth = [
    {
      key: "serverRssMb" as const,
      limit: LEAK_PER_LAP.serverRssMb,
      unit: "MB",
      what: "server memory (RSS)",
    },
    ...(sameDocument
      ? [
          {
            key: "heapMb" as const,
            limit: LEAK_PER_LAP.heapMb,
            unit: "MB",
            what: "browser JS heap",
          },
          { key: "nodes" as const, limit: LEAK_PER_LAP.nodes, unit: "nodes", what: "DOM nodes" },
          {
            key: "listeners" as const,
            limit: LEAK_PER_LAP.listeners,
            unit: "listeners",
            what: "event listeners",
          },
        ]
      : []),
  ];

  return growth
    .map((metric) => ({ ...metric, value: lateGrowth(samples, metric.key) }))
    .filter((metric) => metric.value > metric.limit)
    .map((metric) => ({
      check: "memory",
      level: "warn",
      message: `${metric.what} kept growing through the later laps (over ${metric.limit} ${metric.unit} a lap): a leak?`,
      unit: metric.unit,
      value: metric.value,
    }));
}

function format(value: number | null, digits: number): string {
  return value === null ? "–" : value.toFixed(digits);
}

export function soakRows({ laps, paths, sameDocument, samples }: SoakReport): string[] {
  const rows: [string, keyof MemorySample, number][] = [
    ["Browser JS heap (MB)", "heapMb", 1],
    ["DOM nodes", "nodes", 0],
    ["Event listeners", "listeners", 0],
    ["Documents", "documents", 0],
    ["Server RSS (MB)", "serverRssMb", 1],
  ];

  const half = middle(samples.length);

  return [
    `## Memory over ${laps} laps of ${paths.join(" → ")}`,
    "",
    sameDocument
      ? "Sampled after a forced garbage collection after every lap; growth is judged from the middle lap on, once caches have filled."
      : "The tab reloaded during the laps (one path, or no link to the next), so only the server's memory is judged.",
    "",
    `| | After lap 1 | After lap ${half} | After lap ${samples.length} | Per lap since lap ${half} |`,
    "| --- | --- | --- | --- | --- |",
    ...rows.map(([label, key, digits]) => {
      const at = (lap: number) => samples[lap - 1]?.[key] ?? null;
      return `| ${label} | ${format(at(1), digits)} | ${format(at(half), digits)} | ${format(at(samples.length), digits)} | ${format(lateGrowth(samples, key), digits)} |`;
    }),
    "",
  ];
}
