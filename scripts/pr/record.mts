/* oxlint-disable no-await-in-loop -- One screen at a time: steps may change the learner's state. */
import { mkdir, rename, rm } from "node:fs/promises";
import { join, posix } from "node:path";
import {
  type Browser,
  type BrowserContextOptions,
  type Page,
  type PageScreenshotOptions,
} from "@playwright/test";
import { openPage, waitForQuiet } from "../verify/browser.mts";
import { type Scheme, VIEWPORTS, type ViewportName } from "../verify/viewports.mts";
import {
  type CaptureItem,
  type Read,
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
}: Scene & { folder: string; scheme: Scheme; viewport: ViewportName }): Promise<Unhashed[]> {
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

  return items;
}

/** A retake with the same bytes shows what was read, so it keeps that read. */
async function hashItems({
  folder,
  items,
  reads,
}: {
  folder: string;
  items: Unhashed[];
  reads: Map<string, Read>;
}): Promise<CaptureItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const sha256 = await sha256File(join(folder, item.file));
      const read = reads.get(sha256);
      return { ...item, sha256, ...(read && { read }) };
    }),
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

  for (const viewport of viewports) {
    for (const scheme of schemes) {
      unhashed.push(...(await captureScreen({ ...scene, folder: scratch, scheme, viewport })));
    }
  }

  const previous = (await readCapture(folder)) ?? [];

  const reads = new Map(
    previous.flatMap((item) => (item.read ? [[item.sha256, item.read] as const] : [])),
  );

  const items = await hashItems({ folder: scratch, items: unhashed, reads });
  await writeManifest(scratch, items);
  await rm(folder, { force: true, recursive: true });
  await rename(scratch, folder);
  return items;
}
