import { type CDPSession } from "@playwright/test";
import { openPage, waitForQuiet } from "./browser.mts";
import { type Finding } from "./checks.mts";
import { type Target } from "./measure.mts";
import { isNextDev } from "./probe.mts";
import { redactQuery } from "./requests.mts";
import { readRssMb } from "./server-process.mts";
import { LOAD_TIMEOUT_MS, tapTo } from "./tap.mts";

const BYTES_PER_MB = 1024 * 1024;

/** What the browser holds after a forced garbage collection, and the Next.js server's memory. */
export type MemorySample = {
  documents: number;
  heapMb: number;
  listeners: number;
  nodes: number;
  serverRssMb: number | null;
};

export type SoakReport = {
  first: MemorySample;
  laps: number;
  last: MemorySample;
  paths: string[];
  /** Memory is judged only on a production build: dev tooling and on-demand compiling grow it. */
  production: boolean;
  /** The tab kept one document through every lap; a reload resets the browser's memory. */
  sameDocument: boolean;
};

/**
 * Growth per lap, after the first lap warmed the caches, that points at a leak: memory a page
 * keeps after the learner left it. A steady app levels off; a leak grows every lap.
 */
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

/**
 * Walks the paths `laps` times in one tab, by their links, as a learner moving around a session
 * does (one path reloads itself), and samples memory after the first lap and after the last.
 */
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
    await cdp.send("Performance.enable");
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

      if (round === 1 || round === laps) {
        // oxlint-disable-next-line no-await-in-loop -- Samples after this lap.
        samples.push(await sample(cdp, target.serverPid));
      }
    }
    // A path with no link to the next one is loaded instead, which replaces the document.
    state.sameDocument = (await page.evaluate(() => performance.timeOrigin)) === state.startedAt;
  } finally {
    await context.close();
  }

  const [first, last = first] = samples;

  if (!first || !last) {
    throw new Error("The soak took no memory samples.");
  }

  return {
    first,
    laps,
    last,
    paths: paths.map((path) => redactQuery(path)),
    production: state.production,
    sameDocument: paths.length > 1 && state.sameDocument,
  };
}

/**
 * Memory that keeps growing lap after lap. The browser's counts only when the tab kept one
 * document (one path reloads itself, and a missing link loads the next page), the server's always.
 */
export function judgeSoak({ first, laps, last, production, sameDocument }: SoakReport): Finding[] {
  if (laps < 2 || !production) {
    return [];
  }

  const perLap = (before: number | null, after: number | null) =>
    before === null || after === null ? 0 : (after - before) / (laps - 1);

  const growth = [
    {
      limit: LEAK_PER_LAP.serverRssMb,
      unit: "MB",
      value: perLap(first.serverRssMb, last.serverRssMb),
      what: "server memory (RSS)",
    },
    ...(sameDocument
      ? [
          {
            limit: LEAK_PER_LAP.heapMb,
            unit: "MB",
            value: perLap(first.heapMb, last.heapMb),
            what: "browser JS heap",
          },
          {
            limit: LEAK_PER_LAP.nodes,
            unit: "nodes",
            value: perLap(first.nodes, last.nodes),
            what: "DOM nodes kept",
          },
          {
            limit: LEAK_PER_LAP.listeners,
            unit: "listeners",
            value: perLap(first.listeners, last.listeners),
            what: "event listeners",
          },
        ]
      : []),
  ];

  return growth
    .filter((metric) => metric.value > metric.limit)
    .map((metric) => ({
      check: "memory",
      level: "warn",
      message: `${metric.what} grew every lap (over ${metric.limit} ${metric.unit} a lap): a leak?`,
      unit: metric.unit,
      value: metric.value,
    }));
}

function format(value: number | null, digits: number): string {
  return value === null ? "–" : value.toFixed(digits);
}

/** The soak's samples as a report table: after the first lap, after the last, and per lap. */
export function soakRows({ first, laps, last, paths, sameDocument }: SoakReport): string[] {
  const rows: [string, keyof MemorySample, number][] = [
    ["Browser JS heap (MB)", "heapMb", 1],
    ["DOM nodes", "nodes", 0],
    ["Event listeners", "listeners", 0],
    ["Documents", "documents", 0],
    ["Server RSS (MB)", "serverRssMb", 1],
  ];

  return [
    `## Memory over ${laps} laps of ${paths.join(" → ")}`,
    "",
    sameDocument
      ? "Sampled after a forced garbage collection, after the first lap (caches warm) and after the last."
      : "The tab reloaded during the laps (one path, or no link to the next), so only the server's memory is judged.",
    "",
    "| | After lap 1 | After the last lap | Per lap |",
    "| --- | --- | --- | --- |",
    ...rows.map(([label, key, digits]) => {
      const before = first[key];
      const after = last[key];

      const perLap =
        before === null || after === null || laps < 2 ? null : (after - before) / (laps - 1);

      return `| ${label} | ${format(before, digits)} | ${format(after, digits)} | ${format(perLap, digits)} |`;
    }),
    "",
  ];
}
