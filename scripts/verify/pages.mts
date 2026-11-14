/* oxlint-disable unicorn/no-process-exit -- Help and invalid options exit the CLI before browser setup. */
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
import { markBusy } from "./busy.mts";
import { type Finding } from "./checks.mts";
import { readTypeScale } from "./craft-scale.mts";
import { checkExposure } from "./exposure.mts";
import { readShortcuts } from "./keys.mts";
import { type LoadReport, measureLoad, warmUp } from "./measure.mts";
import { type SoakReport, judgeSoak, measureSoak, soakRows } from "./memory.mts";
import { type NavigationMode } from "./navigation-checks.mts";
import { type NavigationReport, measureNavigations } from "./navigations.mts";
import { PAGE_OPTIONS, USAGE } from "./pages-usage.mts";
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
import { type RoleCapture, captureRoles, renderRoleSheets } from "./roles.mts";
import { findServerPid } from "./server-process.mts";
import { renderNavigationSheet, renderSheets } from "./sheets.mts";
import { signIn } from "./sign-in.mts";
import { walkStates } from "./states.mts";
import { SCHEMES, THROTTLING, VIEWPORT_NAMES, type ViewportName, pick } from "./viewports.mts";

const repository = resolve(import.meta.dirname, "../..");

function options() {
  try {
    return parseArgs({ allowPositionals: true, options: PAGE_OPTIONS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${message.split(" To specify a positional argument")[0]}\n\n${USAGE}`);
    process.exit(2);
  }
}

const { positionals, values } = options();

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

const served = resolve(values.checkout ?? repository);

const baseUrl = values.url ?? getServiceUrl({ currentDirectory: served, serviceName: values.app });

const paths = positionals.length > 0 ? positionals : ["/"];
const viewports = pick(values.viewports, VIEWPORT_NAMES, "viewport");
const schemes = pick(values.schemes, SCHEMES, "scheme");
const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
const out = resolve(values.out ?? join(repository, "tmp/verify", stamp));
const serverPid = findServerPid(new URL(baseUrl));

assertBrowserLaunchAllowed();

const mailboxUrl =
  values.email || values.intruder
    ? getMailboxCaptureUrl(getServiceUrl({ currentDirectory: served, serviceName: "mailbox" }))
    : "";

const signedIn = values.email
  ? await signIn({ app: values.app, baseUrl, email: values.email, mailboxUrl })
  : undefined;

const learner = signedIn?.learner;

/** `--local-storage name=value` sets what the page keeps on the device, such as a collapsed sidebar. */
const localStorage = (values["local-storage"] ?? []).map((pair) => {
  const [name = "", ...value] = pair.split("=");
  return { name, value: value.join("=") };
});

const storageState =
  localStorage.length > 0
    ? {
        cookies: signedIn?.storageState.cookies ?? [],
        origins: [{ localStorage, origin: new URL(baseUrl).origin }],
      }
    : signedIn?.storageState;

const intruder = values.intruder
  ? await signIn({ app: values.app, baseUrl, email: values.intruder, mailboxUrl })
  : undefined;

const baseline = values.baseline ? await readBaseline(resolve(values.baseline)) : null;
const laps = Number(values.soak ?? 0);

await mkdir(out, { recursive: true });
/**
 * Back-to-back runs of the same build at 2 runnable tasks per core agreed within 1% (6% for server
 * CPU); at 4.6 per core single loads swung by seconds.
 */
const loadPerCore = () => (loadavg()[0] ?? 0) / availableParallelism();
const BUSY_LOAD_PER_CORE = 3;
const loadAtStart = loadPerCore();
const browser = await chromium.launch();
const actions = readActionNames(served);

const queries = values.queries ? resolve(values.queries) : undefined;

const target = {
  actions,
  app: values.app,
  baseUrl,
  browser,
  out,
  queries,
  serverPid,
  shortcuts: await readShortcuts(served),
  storageState,
  throttle: values.throttle,
  typeScale: readTypeScale(served),
};

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
const roles: RoleCapture[] = [];
let soak: SoakReport | null = null;
const renders: RenderReport[] = [];

const navigationViewports: ViewportName[] = viewports.filter(
  (viewport) => viewport === "phone" || viewport === "laptop",
);

try {
  for (const path of paths) {
    await warmUp(target, path);

    for (const viewport of viewports) {
      const load = await measureLoad(target, { path, schemes, viewport });

      // Craft's X3 on the two sizes the craft read uses: what a person's taps and typing move.
      if (navigationViewports.includes(viewport)) {
        const { findings, ...coverage } = await walkStates(target, {
          capture: values.roles
            ? async (page, state) => {
                roles.push(...(await captureRoles(page, { out, path, state, viewport })));
              }
            : undefined,
          path,
          viewport,
        });

        load.walk = coverage;
        load.findings.push(...findings);
      }

      const failing = load.findings.filter((finding) => finding.level === "fail").length;

      console.log(
        `${path} ${viewport}: ${failing} failing, ${load.findings.length - failing} to look at`,
      );

      for (const finding of load.findings.filter((item) => item.level === "fail")) {
        console.log(`  ${finding.check}: ${finding.message}`);
      }

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

  for (const path of queries ? paths : []) {
    const summary = summarizeStatements(
      await measureRender({ baseUrl, file: queries ?? "", path, storageState }),
    );

    const production = loads.every((load) => load.production);
    const unindexed = await findUnindexed(served, { production, reads: summary.reads });

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
    ...(values.roles
      ? await renderRoleSheets(browser, {
          captures: roles,
          out,
          paths,
          viewports: navigationViewports,
        })
      : []),
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

const exposures = learner
  ? await checkExposure({ baseUrl, intruder: intruder?.storageState, learner, paths })
  : [];

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
      findings: judge(findings),
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
