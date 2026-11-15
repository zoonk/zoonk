/* oxlint-disable no-console, no-await-in-loop -- This CLI reaches one scenario at a time, in order, and prints what it found. */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { type BrowserContext, type Page, chromium } from "@playwright/test";
import { getMailboxCaptureUrl, getServiceUrl } from "../../dev/config.mts";
import { type Capture } from "../alignment-capture.mts";
import { readAlignment, webCapture } from "../alignment-probe.mts";
import { alignmentLines, summaryLine } from "../alignment-summary.mts";
import { WEB_TABLE } from "../alignment-table.mts";
import { evaluateFile } from "../alignment.mts";
import { installPageHelpers } from "../page-helpers.mts";
import { signIn } from "../sign-in.mts";
import { VIEWPORTS, VIEWPORT_NAMES, type ViewportName } from "../viewports.mts";
import { localePath, proofIn } from "./configuration.mts";
import { type Prerequisites, SCENARIOS, type Scenario, type Step } from "./scenarios.mts";

const USAGE = `Usage: pnpm verify:scenarios [id...] [--out <dir>]

Reaches each named scenario (every one the web can reach when none is named) in this checkout's
running app, from a fresh learner made with pnpm dev:persona, at each of the scenario's sizes;
checks its words show; captures it; and judges the captures, their state pairs and the run against
the list. A scenario the web can't reach yet (it needs a seeded state) is captured as unreached
and fails, so it can't be skipped unnoticed. Writes alignment.json and a picture of each capture.`;

const repository = resolve(import.meta.dirname, "../../..");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { help: { default: false, type: "boolean" }, out: { type: "string" } },
});

const baseUrl = getServiceUrl({ currentDirectory: repository, serviceName: "main" });
const playgroundUrl = getServiceUrl({ currentDirectory: repository, serviceName: "playground" });

const mailboxUrl = getMailboxCaptureUrl(
  getServiceUrl({ currentDirectory: repository, serviceName: "mailbox" }),
);

const STEP_TIMEOUT_MS = 15_000;
const SETTLE_MS = 1200;

/** A fresh learner for each set of prerequisites, so one scenario's taps never reach another. */
function makePersona(
  { flags = [], name }: { flags?: string[]; name: string },
  state: string | undefined,
): string {
  const output = execFileSync(
    "pnpm",
    ["dev:persona", name, ...flags, ...(state ? ["--state", state] : [])],
    { cwd: repository, encoding: "utf8" },
  );

  const email = /Email\s+(?<email>\S+@\S+)/u.exec(output)?.groups?.email;

  if (!email) {
    throw new Error(`pnpm dev:persona ${name} printed no email:\n${output}`);
  }

  return email;
}

async function storageFor(prerequisites: Prerequisites) {
  const signedIn =
    prerequisites.persona === "visitor"
      ? null
      : await signIn({
          app: "main",
          baseUrl,
          email: makePersona(prerequisites.persona, prerequisites.state),
          mailboxUrl,
        });

  const local = Object.entries(prerequisites.storage ?? {}).map(([name, value]) => ({
    name,
    value,
  }));

  return local.length > 0
    ? {
        cookies: signedIn?.storageState.cookies ?? [],
        origins: [{ localStorage: local, origin: new URL(baseUrl).origin }],
      }
    : signedIn?.storageState;
}

async function take(page: Page, step: Step) {
  if ("click" in step) {
    const named = page
      .getByRole("button", { exact: true, name: step.click })
      .or(page.getByRole("link", { exact: true, name: step.click }));

    await named
      .or(page.getByText(step.click, { exact: true }))
      .first()
      .click({ timeout: STEP_TIMEOUT_MS });
  } else if ("wait" in step) {
    await page
      .getByText(step.wait, { exact: true })
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: STEP_TIMEOUT_MS });
  } else if ("pause" in step) {
    await page.waitForTimeout(step.pause);
  } else if ("press" in step) {
    await page.keyboard.press(step.press);
  } else if ("fill" in step) {
    const field = page.getByLabel(step.fill.field).or(page.getByPlaceholder(step.fill.field));
    await field.first().fill(step.fill.value);
  } else {
    await page.evaluate(() => globalThis.scrollTo(0, document.documentElement.scrollHeight));
  }
}

type Configuration = Omit<Scenario["sizes"][number], "size"> & { size: ViewportName };

/** A run's name for one configuration, in its pictures' names and its lines. */
function configurationLabel({ locale, size, textScale }: Configuration) {
  return [size, locale, textScale && `text ${textScale}x`].filter(Boolean).join(" ");
}

/** Chromium's default text size, the browser setting a learner changes; the app sizes text in rem. */
const DEFAULT_TEXT_PX = 16;

/** React's inline functions that move streamed content into its placeholder's place. */
const STREAM_SWAPS = ["$RC", "$RS", "$RX", "$RV", "$RM", "$RR", "$RT"];

/**
 * A hard load's first paint, held: the page's inline scripts run (the signed-in hint the bars read
 * included), but its code never loads to hydrate and React's inline swaps do nothing, so what
 * streams after the placeholder never takes its place.
 */
async function holdFirstPaint(context: BrowserContext) {
  await context.route(/\/_next\/static\/chunks\/.+\.js(?:\?.*)?$/u, async (route) => route.abort());

  await context.addInitScript((names: string[]) => {
    for (const name of names) {
      Object.defineProperty(globalThis, name, { value: () => null, writable: false });
    }
  }, STREAM_SWAPS);
}

async function capture(
  scenario: Scenario,
  configuration: Configuration,
  storage: Awaited<ReturnType<typeof storageFor>>,
  out: string,
): Promise<Capture> {
  const { locale, size, textScale = 1 } = configuration;
  const label = configurationLabel(configuration);
  const path = localePath(scenario.from ?? scenario.screen, locale);
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({
      ...VIEWPORTS[size],
      baseURL: scenario.app === "playground" ? playgroundUrl : baseUrl,
      storageState: storage,
    });

    await context.addInitScript(installPageHelpers);

    if (scenario.firstPaint) {
      await holdFirstPaint(context);
    }

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    await cdp.send("Page.setFontSizes", {
      fontSizes: { standard: Math.round(DEFAULT_TEXT_PX * textScale) },
    });

    await page.goto(path, { waitUntil: "networkidle" });

    // A step that can't be taken leaves the scenario unreached, never a crash of the run.
    const stepped = await (async () => {
      for (const step of scenario.reach ?? []) {
        await take(page, step);
      }
    })().then(
      () => true,
      (error: unknown) => {
        console.error(
          `${scenario.id} ${label}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
        );

        return false;
      },
    );

    await page.waitForTimeout(SETTLE_MS);

    const proof = scenario.firstPaint
      ? page.locator("[aria-busy=true]")
      : page.getByText(proofIn(scenario.proof, locale));

    // Words a learner typed are a field's value, not its text.
    const typed = async () =>
      page
        .locator("input, textarea")
        .evaluateAll(
          (fields, words) => fields.some((field) => "value" in field && field.value === words),
          proofIn(scenario.proof, locale),
        );

    const reached =
      stepped &&
      scenario.reach !== null &&
      ((await proof
        .filter({ visible: true })
        .first()
        .isVisible()
        .catch(() => false)) ||
        (await typed()));

    const anchors = scenario.anchors.flatMap((anchor) =>
      anchor.web ? [{ id: anchor.id, web: anchor.web }] : [],
    );

    const read = await page.evaluate(readAlignment, { ...WEB_TABLE, anchors });

    await page.screenshot({
      fullPage: true,
      path: join(out, `${scenario.id}-${label.replaceAll(" ", "-")}.png`),
    });

    return {
      // The page a step reached (a placeholder's), not only the one the scenario opened.
      ...webCapture({
        app: scenario.app ?? "main",
        page: read,
        path: new URL(page.url()).pathname,
        scheme: "light",
        textScale,
        viewport: size,
      }),
      reached,
      scenario: scenario.id,
    };
  } finally {
    await browser.close();
  }
}

if (values.help) {
  console.log(USAGE);
} else {
  const unknown = positionals.filter((id) => !SCENARIOS.some((scenario) => scenario.id === id));

  const chosen =
    positionals.length > 0
      ? SCENARIOS.filter((scenario) => positionals.includes(scenario.id))
      : SCENARIOS.filter((scenario) => scenario.reach !== null);

  const out = resolve(
    values.out ??
      join(repository, "tmp/verify/scenarios", new Date().toISOString().replaceAll(/[:.]/gu, "-")),
  );

  await mkdir(out, { recursive: true });

  const captures: Capture[] = [];

  for (const scenario of chosen) {
    const shared =
      scenario.reach === null || scenario.writes
        ? undefined
        : await storageFor(scenario.prerequisites);

    // The web's sizes; a native size (a watch, a fold) isn't the web's to capture.
    const configurations = scenario.sizes.flatMap(({ size, ...rest }) =>
      VIEWPORT_NAMES.filter((name) => name === size).map((name) => ({ ...rest, size: name })),
    );

    for (const configuration of configurations) {
      const taken =
        scenario.reach === null
          ? {
              ...webCapture({
                app: scenario.app ?? "main",
                page: { activeSurface: "page", elements: [] },
                path: localePath(scenario.screen, configuration.locale),
                scheme: "light",
                textScale: configuration.textScale,
                viewport: configuration.size,
              }),
              reached: false,
              scenario: scenario.id,
            }
          : await capture(
              scenario,
              configuration,
              shared ?? (await storageFor(scenario.prerequisites)),
              out,
            );

      console.log(
        `${scenario.id} ${configurationLabel(configuration)}: ${taken.reached ? "reached" : `not reached${scenario.prerequisites.seed ? ` (needs ${scenario.prerequisites.seed})` : ""}`}`,
      );

      captures.push(taken);
    }
  }

  const file = { captures, required: [...chosen.map((scenario) => scenario.id), ...unknown] };
  const evaluated = evaluateFile(file);
  await writeFile(join(out, "alignment.json"), JSON.stringify({ ...file, ...evaluated }, null, 2));

  console.log(
    [...alignmentLines(evaluated.findings), `Output: ${out}`, summaryLine(evaluated.summary)].join(
      "\n",
    ),
  );

  process.exitCode = evaluated.summary.failed ? 1 : 0;
}
