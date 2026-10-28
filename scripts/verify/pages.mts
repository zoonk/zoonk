/* oxlint-disable no-console, no-await-in-loop -- This CLI measures one page load at a time, in order, and prints its report. */
import { mkdir, writeFile } from "node:fs/promises";
import { availableParallelism, loadavg } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { assertBrowserLaunchAllowed } from "../../packages/testing/src/browser-preflight.ts";
import { getMailboxCaptureUrl, getServiceUrl } from "../dev/config.mts";
import { readActionNames } from "./actions.mts";
import { compareWithBaseline, comparisonRows, readBaseline } from "./baseline.mts";
import { type Finding, markBusy } from "./checks.mts";
import { checkExposure, readLearner } from "./exposure.mts";
import { type LoadReport, measureLoad, warmUp } from "./measure.mts";
import { type SoakReport, judgeSoak, measureSoak, soakRows } from "./memory.mts";
import { type NavigationMode } from "./navigation-checks.mts";
import { type NavigationReport, measureNavigations } from "./navigations.mts";
import {
  type RenderReport,
  findUnindexed,
  measureRender,
  queryFindings,
  renderRows,
  summarizeStatements,
} from "./queries.mts";
import { renderReport } from "./report.mts";
import { redactQuery, savedRequest } from "./requests.mts";
import { findServerPid } from "./server-process.mts";
import { renderNavigationSheet, renderSheets } from "./sheets.mts";
import { signIn } from "./sign-in.mts";
import { THROTTLING, VIEWPORT_NAMES, type ViewportName } from "./viewports.mts";

/**
 * Measures pages the way a learner meets them (`pnpm verify:pages [path...]`): each path loaded
 * fresh on every screen size and color scheme, judged by `checks.mts`, with screenshots, paint
 * frames and a report. `--nav` also taps through the paths in order. The verify skill explains
 * when to run it and how to read it.
 */
const repository = resolve(import.meta.dirname, "../..");
const SCHEMES = ["light", "dark"] as const;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    baseline: { type: "string" },
    early: { default: false, type: "boolean" },
    email: { type: "string" },
    intruder: { type: "string" },
    nav: { default: false, type: "boolean" },
    "no-prefetch": { default: false, type: "boolean" },
    out: { type: "string" },
    queries: { type: "string" },
    schemes: { default: SCHEMES.join(","), type: "string" },
    soak: { type: "string" },
    throttle: { default: false, type: "boolean" },
    url: { type: "string" },
    viewports: { default: VIEWPORT_NAMES.join(","), type: "string" },
  },
});

function pick<T extends string>(list: string, allowed: readonly T[], name: string): T[] {
  return list.split(",").map((item) => {
    const match = allowed.find((candidate) => candidate === item.trim());

    if (!match) {
      throw new Error(`Unknown ${name} "${item}". Use ${allowed.join(", ")}.`);
    }

    return match;
  });
}

const baseUrl = values.url ?? getServiceUrl({ currentDirectory: repository, serviceName: "main" });
const paths = positionals.length > 0 ? positionals : ["/"];
const viewports = pick(values.viewports, VIEWPORT_NAMES, "viewport");
const schemes = pick(values.schemes, SCHEMES, "scheme");
const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
const out = resolve(values.out ?? join(repository, "tmp/verify", stamp));
const serverPid = findServerPid(new URL(baseUrl));

assertBrowserLaunchAllowed();

const mailboxUrl =
  values.email || values.intruder
    ? getMailboxCaptureUrl(getServiceUrl({ currentDirectory: repository, serviceName: "mailbox" }))
    : "";

const storageState = values.email
  ? await signIn({ baseUrl, email: values.email, mailboxUrl })
  : undefined;

const learner = storageState ? await readLearner(baseUrl, storageState) : null;

const intruder = values.intruder
  ? await signIn({ baseUrl, email: values.intruder, mailboxUrl })
  : undefined;

const baseline = values.baseline ? await readBaseline(resolve(values.baseline)) : null;
const laps = Number(values.soak ?? 0);

await mkdir(out, { recursive: true });
/**
 * Runnable tasks per core over the last minute. Back-to-back runs of the same build at 2 per core
 * agreed within 1% (6% for server CPU); at 4.6 per core single loads swung by seconds.
 */
const loadPerCore = () => (loadavg()[0] ?? 0) / availableParallelism();
const BUSY_LOAD_PER_CORE = 3;
const loadAtStart = loadPerCore();
const browser = await chromium.launch();
const actions = readActionNames(repository);

const queries = values.queries ? resolve(values.queries) : undefined;

const target = {
  actions,
  baseUrl,
  browser,
  out,
  queries,
  serverPid,
  storageState,
  throttle: values.throttle,
};

/** How `--nav` taps: after prefetches landed, with them blocked, or right after a cold load. */
function navigationMode(): NavigationMode {
  if (values.early) {
    return "early";
  }

  return values["no-prefetch"] ? "noPrefetch" : "prefetched";
}

const mode = navigationMode();

const loads: LoadReport[] = [];
const navigations: NavigationReport[] = [];
const sheets: string[] = [];
let soak: SoakReport | null = null;
const renders: RenderReport[] = [];

/** Navigations run on a phone and a laptop (whichever were asked for), or the first screen asked. */
const navigationViewports: ViewportName[] = viewports.filter(
  (viewport) => viewport === "phone" || viewport === "laptop",
);

try {
  for (const path of paths) {
    await warmUp(target, path);

    for (const viewport of viewports) {
      const load = await measureLoad(target, { path, schemes, viewport });
      const failing = load.findings.filter((finding) => finding.level === "fail").length;

      console.log(
        `${path} ${viewport}: ${failing} failing, ${load.findings.length - failing} to look at`,
      );

      loads.push(load);
    }
  }

  if (values.nav && paths.length > 1) {
    for (const viewport of navigationViewports.length > 0
      ? navigationViewports
      : viewports.slice(0, 1)) {
      navigations.push(...(await measureNavigations(target, { mode, paths, viewport })));
    }
  }

  // Each page's render on its own: the statements it sends, and the plans of its reads.
  for (const path of queries ? paths : []) {
    const summary = summarizeStatements(
      await measureRender({ baseUrl, file: queries ?? "", path, storageState }),
    );

    const production = loads.every((load) => load.production);
    const unindexed = await findUnindexed(repository, { production, reads: summary.reads });

    renders.push({
      findings: [...queryFindings(summary), ...unindexed],
      path: redactQuery(path),
      summary,
    });
  }

  if (laps > 0) {
    soak = await measureSoak(target, { laps, paths });
  }

  sheets.push(
    ...(await renderSheets(browser, { baseline: baseline?.loads ?? [], loads })),
    ...(await renderNavigationSheet(browser, { navigations, out })),
  );
} finally {
  await browser.close();
}

const production = loads.every((load) => load.production);
const loadAtEnd = loadPerCore();
const busy = Math.max(loadAtStart, loadAtEnd) > BUSY_LOAD_PER_CORE;
const judge = (findings: Finding[]) => (busy ? markBusy(findings) : findings);
const judgedLoads = loads.map((load) => ({ ...load, findings: judge(load.findings) }));
const judgedNavigations = navigations.map((hop) => ({ ...hop, findings: judge(hop.findings) }));
const exposures = learner ? await checkExposure({ baseUrl, intruder, learner, paths }) : [];

const comparison = baseline
  ? compareWithBaseline(baseline.loads, loads, {
      sameSettings: baseline.throttle === values.throttle,
    })
  : null;

const header = [
  `Target: ${baseUrl} (${production ? "production build" : "next dev: speed, skeletons and prefetching aren't judged; measure them on pnpm start"})`,
  `Throttled: ${values.throttle ? `${THROTTLING.cpuRate}× CPU, slow 4G` : "no"}; signed in: ${values.email ?? "no"}; server CPU: ${serverPid ? `pid ${serverPid}` : "not measured"}`,
  ...(values.nav
    ? [
        `Taps: ${{ early: "right after a cold load showed its content, before its code was ready", noPrefetch: "with the next pages' prefetches blocked", prefetched: "after the page's prefetches landed" }[mode]}`,
      ]
    : []),
  `Output: ${out}`,
  `Machine load: ${loadAtStart.toFixed(1)} runnable tasks per core at the start, ${loadAtEnd.toFixed(1)} at the end${busy ? " (busy: speed, memory and regressions are inconclusive; main-thread work and counts still hold)" : ""}`,
];

const report = renderReport({
  extra: [
    ...renders.map(({ findings, path }) => ({
      findings,
      place: { page: path, screen: "its render" },
    })),
    ...exposures.map(({ findings, path, viewer }) => ({
      findings,
      place: { page: path, screen: viewer },
    })),
    ...(soak
      ? [
          {
            findings: judge(judgeSoak(soak)),
            place: { page: "memory", screen: `${soak.laps} laps` },
          },
        ]
      : []),
    ...(comparison?.findings ?? []).map(({ finding, path, viewport }) => ({
      findings: judge([finding]),
      place: { page: path, screen: viewport },
    })),
  ],
  header: [
    ...header,
    ...(learner
      ? [
          `Exposure: each path opened signed out${intruder ? ` and as ${values.intruder}` : ""} must not carry ${learner.email}'s email, account id or full name`,
        ]
      : []),
    ...(baseline ? [`Baseline: ${values.baseline}`] : []),
  ],
  loads: judgedLoads,
  navigations: judgedNavigations,
  out,
  sections: [
    ...renderRows(renders),
    ...(soak ? soakRows(soak) : []),
    ...(comparison ? comparisonRows(comparison) : []),
  ],
  sheets,
});

await writeFile(join(out, "report.md"), `${report.markdown}\n`);

await writeFile(
  join(out, "report.json"),
  JSON.stringify(
    {
      baseUrl,
      exposures,
      loadPerCore: { end: loadAtEnd, start: loadAtStart },
      loads: judgedLoads.map((load) => ({ ...load, requests: load.requests.map(savedRequest) })),
      navigations: judgedNavigations.map((hop) => ({
        ...hop,
        requests: hop.requests.map(savedRequest),
      })),
      renders,
      soak,
      throttle: values.throttle,
    },
    null,
    2,
  ),
);

console.log(`\n${report.markdown}\n\nReport: ${join(out, "report.md")}`);
process.exitCode = report.failures > 0 ? 1 : 0;
