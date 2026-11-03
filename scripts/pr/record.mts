/* oxlint-disable no-await-in-loop -- One screen at a time: steps may change the learner's state. */
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import {
  type Browser,
  type BrowserContextOptions,
  type Page,
  type PageScreenshotOptions,
} from "@playwright/test";
import { openPage, waitForQuiet } from "../verify/browser.mts";
import { type Scheme, VIEWPORTS, type ViewportName } from "../verify/viewports.mts";
import { type CaptureItem, MANIFEST, type Side, fileName, pathShotName } from "./media.mts";

/** Waits until the page stops changing, unless `settle` is false, as for a loading state. */
type Shot = (
  name: string,
  options?: Omit<PageScreenshotOptions, "path"> & { settle?: boolean },
) => Promise<void>;

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
  steps: Steps;
  storageState?: BrowserContextOptions["storageState"];
  video: boolean;
};

async function captureScreen({
  baseUrl,
  browser,
  folder,
  scheme,
  steps,
  storageState,
  video,
  viewport,
}: Scene & { folder: string; scheme: Scheme; viewport: ViewportName }): Promise<CaptureItem[]> {
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
  const items: CaptureItem[] = [];

  if (video) {
    await page.screencast.start({
      path: join(folder, `${screen}.webm`),
      size: VIEWPORTS[viewport].viewport ?? undefined,
    });

    await page.screencast.showActions();
  }

  const shot: Shot = async (text, { settle = true, ...options } = {}) => {
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

    items.push({ file, kind: "shot", name, scheme, viewport });
  };

  try {
    await steps({ page, scheme, shot, viewport });
  } finally {
    if (video) {
      await page.screencast.stop();
    }

    await context.close();
  }

  return video ? [...items, { file: `${screen}.webm`, kind: "video", scheme, viewport }] : items;
}

/**
 * Captures into a scratch folder that replaces the side's only once every screen worked, so a
 * failed run keeps the last good capture and `media.md` still matches it.
 */
export async function captureSide({
  out,
  schemes,
  side,
  viewports,
  ...scene
}: Scene & { out: string; schemes: Scheme[]; side: Side; viewports: ViewportName[] }): Promise<
  CaptureItem[]
> {
  const folder = join(out, side);
  const scratch = join(out, `${side}.partial`);
  await rm(scratch, { force: true, recursive: true });
  await mkdir(scratch, { recursive: true });

  const items: CaptureItem[] = [];

  for (const viewport of viewports) {
    for (const scheme of schemes) {
      items.push(...(await captureScreen({ ...scene, folder: scratch, scheme, viewport })));
    }
  }

  await writeFile(join(scratch, MANIFEST), `${JSON.stringify(items, null, 2)}\n`);
  await rm(folder, { force: true, recursive: true });
  await rename(scratch, folder);
  return items;
}
