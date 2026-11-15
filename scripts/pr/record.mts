/* oxlint-disable no-await-in-loop -- One screen at a time: steps may change the learner's state. */
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import {
  type Browser,
  type BrowserContextOptions,
  type Page,
  type PageScreenshotOptions,
} from "@playwright/test";
import { type Capture } from "../verify/alignment-capture.mts";
import { readAlignment, webCapture } from "../verify/alignment-probe.mts";
import { WEB_TABLE } from "../verify/alignment-table.mts";
import { evaluateFile } from "../verify/alignment.mts";
import { openPage, waitForQuiet } from "../verify/browser.mts";
import { type Scheme, VIEWPORTS, type ViewportName } from "../verify/viewports.mts";
import { carryReads } from "./carry.mts";
import {
  type CaptureItem,
  type Side,
  fileName,
  pathShotName,
  readCapture,
  writeManifest,
} from "./media.mts";
import { type CheckoutBuild, bindBuild, sha256File } from "./provenance.mts";

/**
 * Waits until the page stops changing, unless `settle` is false, as for a loading state.
 * `scenario` names the state shown, with the id every platform uses for it.
 */
type ShotOptions = Omit<PageScreenshotOptions, "path"> & { scenario?: string; settle?: boolean };
type Shot = (name: string, options?: ShotOptions) => Promise<void>;

/** A `--steps` module's default export, run once on each screen and scheme. */
export type Steps = (scene: {
  page: Page;
  scheme: Scheme;
  shot: Shot;
  viewport: ViewportName;
}) => Promise<void>;

export function visitPaths(paths: string[]): Steps {
  return async ({ page, shot }) => {
    for (const path of paths) {
      const response = await page.goto(path);

      if (response && !response.ok()) {
        throw new Error(
          `${path} ended at ${response.url()} with ${response.status()}: start the apps it needs, or capture an error page with --steps.`,
        );
      }

      await shot(pathShotName(path));
    }
  };
}

type Scene = {
  baseUrl: string;
  browser: Browser;
  checkout: CheckoutBuild;
  side: Side;
  steps: Steps;
  stepsDigest: string;
  storageState?: BrowserContextOptions["storageState"];
  video: boolean;
};

type WithoutHash<T> = T extends unknown ? Omit<T, "sha256"> : never;
type Unhashed = WithoutHash<CaptureItem>;
type Screen = { captures: Capture[]; items: Unhashed[] };

/**
 * The HTML of the newest full page load, which names the build that served it; the page itself
 * drops that payload once it hydrates.
 */
function watchDocuments(page: Page): () => Promise<string> {
  const loads: Promise<string>[] = [];

  page.on("response", (response) => {
    if (response.request().resourceType() === "document" && response.frame() === page.mainFrame()) {
      loads.push(response.text().catch(() => ""));
    }
  });

  return async () => {
    const pages = await Promise.all(loads);
    return pages.findLast((html) => html.length > 0) ?? "";
  };
}

async function captureScreen({
  baseUrl,
  browser,
  checkout,
  folder,
  scheme,
  side,
  steps,
  stepsDigest,
  storageState,
  video,
  viewport,
}: Scene & { folder: string; scheme: Scheme; viewport: ViewportName }): Promise<Screen> {
  const { context, page, traffic } = await openPage({
    actions: new Map(),
    baseUrl,
    browser,
    scheme,
    storageState,
    throttle: false,
    viewport,
  });

  const screen = posix.join(viewport, scheme);
  const items: Unhashed[] = [];
  const captures: Capture[] = [];
  const { deviceScaleFactor = 1, hasTouch = false } = VIEWPORTS[viewport];

  const lastDocument = watchDocuments(page);

  const describe = async () => {
    const [html, lang] = await Promise.all([
      lastDocument(),
      page.evaluate(() => document.documentElement.lang),
    ]);

    return {
      build: bindBuild({ checkout, html }),
      locale: lang || "unknown",
      platform: "web" as const,
      pointer: hasTouch ? ("coarse" as const) : ("fine" as const),
      scale: deviceScaleFactor,
      scheme,
      side,
      steps: stepsDigest,
      viewport,
    };
  };

  if (video) {
    await page.screencast.start({
      path: join(folder, `${screen}.webm`),
      size: VIEWPORTS[viewport].viewport ?? undefined,
    });

    await page.screencast.showActions();
  }

  const shot: Shot = async (text, { scenario, settle = true, ...options }: ShotOptions = {}) => {
    const name = fileName(text);
    const file = posix.join(screen, `${name}.png`);

    if (!name || items.some((item) => item.file === file)) {
      throw new Error(
        `Give each shot on ${screen} its own name with letters or digits: "${text}".`,
      );
    }

    if (settle) {
      await waitForQuiet(page, traffic);
    }

    // Playwright draws the recording's pointer into screenshots too.
    if (video) {
      await page.screencast.hideActions();
    }

    await page.screenshot({ animations: "disabled", ...options, path: join(folder, file) });

    if (video) {
      await page.screencast.showActions();
    }

    // The layout of the state just shot, read before a step can change it.
    const layout = await page.evaluate(readAlignment, WEB_TABLE);
    const path = new URL(page.url()).pathname;

    captures.push({
      ...webCapture({ page: layout, path, scheme, viewport }),
      scenario: scenario ?? null,
    });

    items.push({ ...(await describe()), file, kind: "shot", name, scenario });
  };

  try {
    await steps({ page, scheme, shot, viewport });

    if (video) {
      items.push({ ...(await describe()), file: `${screen}.webm`, kind: "video" });
    }
  } finally {
    if (video) {
      await page.screencast.stop();
    }

    await context.close();
  }

  return { captures, items };
}

async function hashItems({
  folder,
  items,
}: {
  folder: string;
  items: Unhashed[];
}): Promise<CaptureItem[]> {
  return Promise.all(
    items.map(async (item) => ({ ...item, sha256: await sha256File(join(folder, item.file)) })),
  );
}

/**
 * Captures into a scratch folder that replaces the side's only once every screen worked, so a
 * failed run keeps the last good capture and `media.md` still matches it.
 */
export async function captureSide({
  out,
  schemes,
  viewports,
  ...scene
}: Scene & { out: string; schemes: Scheme[]; viewports: ViewportName[] }): Promise<CaptureItem[]> {
  const folder = join(out, scene.side);
  const scratch = join(out, `${scene.side}.partial`);
  await rm(scratch, { force: true, recursive: true });
  await mkdir(scratch, { recursive: true });

  const unhashed: Unhashed[] = [];
  const captures: Capture[] = [];

  for (const viewport of viewports) {
    for (const scheme of schemes) {
      const screen = await captureScreen({ ...scene, folder: scratch, scheme, viewport });
      unhashed.push(...screen.items);
      captures.push(...screen.captures);
    }
  }

  // `pr:media check` fails an after folder on what this leaves unresolved.
  const alignment = { captures, ...evaluateFile({ captures }) };
  await writeFile(join(scratch, "alignment.json"), `${JSON.stringify(alignment, null, 2)}\n`);

  const items = await carryReads({
    folder: scratch,
    items: await hashItems({ folder: scratch, items: unhashed }),
    previous: (await readCapture(folder)) ?? [],
    previousFolder: folder,
  });

  await writeManifest(scratch, items);
  await rm(folder, { force: true, recursive: true });
  await rename(scratch, folder);
  return items;
}
