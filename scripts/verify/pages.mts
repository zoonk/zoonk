/* oxlint-disable no-console, no-await-in-loop -- This CLI measures one page load at a time, in order, and prints its report. */
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { assertBrowserLaunchAllowed } from "../../packages/testing/src/browser-preflight.ts";
import {
  getMailboxCaptureUrl,
  getPortlessEnvironment,
  getProjectName,
  getServiceUrl,
} from "../dev/config.mts";
import { readActionNames } from "./actions.mts";
import {
  type LoadReport,
  type NavigationReport,
  measureLoad,
  measureNavigations,
  warmUp,
} from "./measure.mts";
import { renderReport } from "./report.mts";
import { findServerPid } from "./server-cpu.mts";
import { renderSheets } from "./sheets.mts";
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
    email: { type: "string" },
    nav: { default: false, type: "boolean" },
    out: { type: "string" },
    schemes: { default: SCHEMES.join(","), type: "string" },
    throttle: { default: false, type: "boolean" },
    url: { type: "string" },
    viewports: { default: VIEWPORT_NAMES.join(","), type: "string" },
  },
});

/** This checkout's `pnpm dev` URL for a service, as the persona command finds it. */
function devServiceUrl(serviceName: string): string {
  return getServiceUrl({
    currentDirectory: repository,
    environment: {
      ...process.env,
      ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode: false }),
    },
    projectName: getProjectName({ currentDirectory: repository }),
    serviceName,
  });
}

function pick<T extends string>(list: string, allowed: readonly T[], name: string): T[] {
  return list.split(",").map((item) => {
    const match = allowed.find((candidate) => candidate === item.trim());

    if (!match) {
      throw new Error(`Unknown ${name} "${item}". Use ${allowed.join(", ")}.`);
    }

    return match;
  });
}

const baseUrl = values.url ?? devServiceUrl("main");
const paths = positionals.length > 0 ? positionals : ["/"];
const viewports = pick(values.viewports, VIEWPORT_NAMES, "viewport");
const schemes = pick(values.schemes, SCHEMES, "scheme");
const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
const out = resolve(values.out ?? join(repository, "tmp/verify", stamp));
const serverPid = findServerPid(new URL(baseUrl));

assertBrowserLaunchAllowed();

const storageState = values.email
  ? await signIn({
      baseUrl,
      email: values.email,
      mailboxUrl: getMailboxCaptureUrl(devServiceUrl("mailbox")),
    })
  : undefined;

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const actions = readActionNames(repository);

const target = {
  actions,
  baseUrl,
  browser,
  out,
  serverPid,
  storageState,
  throttle: values.throttle,
};

const loads: LoadReport[] = [];
const navigations: NavigationReport[] = [];
const sheets: string[] = [];

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
      navigations.push(...(await measureNavigations(target, { paths, viewport })));
    }
  }

  sheets.push(...(await renderSheets(browser, loads)));
} finally {
  await browser.close();
}

const production = loads.every((load) => load.production);

const report = renderReport({
  header: [
    `Target: ${baseUrl} (${production ? "production build" : "next dev: speed, skeletons and prefetching aren't judged; measure them on pnpm start"})`,
    `Throttled: ${values.throttle ? `${THROTTLING.cpuRate}× CPU, slow 4G` : "no"}; signed in: ${values.email ?? "no"}; server CPU: ${serverPid ? `pid ${serverPid}` : "not measured"}`,
    `Output: ${out}`,
  ],
  loads,
  navigations,
  out,
  sheets,
});

await writeFile(join(out, "report.md"), `${report.markdown}\n`);
await writeFile(join(out, "report.json"), JSON.stringify({ baseUrl, loads, navigations }, null, 2));
console.log(`\n${report.markdown}\n\nReport: ${join(out, "report.md")}`);
process.exitCode = report.failures > 0 ? 1 : 0;
