import { writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { type Browser } from "@playwright/test";
import { frameFile } from "./browser.mts";
import { type LoadReport, type NavigationReport } from "./measure.mts";

const SHEET_VIEWPORT = { height: 900, width: 1600 };

const STYLE = `
  body { background: #fff; color: #111; font: 13px system-ui, sans-serif; margin: 16px; }
  h1 { font-size: 18px; margin: 0 0 12px; }
  h2 { font-size: 14px; margin: 16px 0 6px; }
  .row { align-items: flex-start; display: flex; flex-wrap: wrap; gap: 12px; }
  figure { margin: 0; }
  figcaption { font-weight: 600; margin-bottom: 4px; }
  img { border: 1px solid #ccc; display: block; }
  .screen img { width: 240px; }
  .paint img { height: 200px; }
`;

function document(title: string, body: string): string {
  return `<!doctype html><meta charset="utf-8"><style>${STYLE}</style><h1>${title}</h1>${body}`;
}

function figure(kind: "paint" | "screen", caption: string, file: string): string {
  return `<figure class="${kind}"><figcaption>${caption}</figcaption><img src="${pathToFileURL(file).href}"></figure>`;
}

/** Renders `html` beside the screenshots it shows and screenshots it whole into `file`. */
async function shoot(browser: Browser, { file, html }: { file: string; html: string }) {
  const source = file.replace(/\.png$/u, ".html");
  await writeFile(source, html);
  const page = await browser.newPage({ viewport: SHEET_VIEWPORT });

  try {
    await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
    await page.screenshot({ fullPage: true, path: file });
  } finally {
    await page.close();
  }
}

/**
 * One image per page with every screen in each scheme (`screens.png`), and one with every paint of
 * each screen's load in order (`paints.png`), so a run is reviewed in two looks per page instead of
 * dozens of files. Returns the sheets' paths.
 */
export async function renderSheets(
  browser: Browser,
  {
    baseline = [],
    loads,
  }: { baseline?: Pick<LoadReport, "path" | "screenshots" | "viewport">[]; loads: LoadReport[] },
): Promise<string[]> {
  const sheets: string[] = [];

  for (const [path, here] of Map.groupBy(loads, (load) => load.path)) {
    const directory = dirname(here[0]?.framesDirectory ?? "");

    // With a baseline, each screen shows before beside after, so unintended changes stand out.
    const screens = here.flatMap((load) =>
      load.screenshots.flatMap((file) => {
        const name = basename(file, ".png");

        const before = baseline
          .find((old) => old.path === path && old.viewport === load.viewport)
          ?.screenshots.find((old) => basename(old) === basename(file));

        return before
          ? [figure("screen", `${name}, before`, before), figure("screen", `${name}, after`, file)]
          : [figure("screen", name, file)];
      }),
    );

    const paints = here.map(
      (load) =>
        `<h2>${load.viewport}</h2><div class="row">${load.frames
          .map((ms) => figure("paint", `${ms} ms`, join(load.framesDirectory, frameFile(ms))))
          .join("")}</div>`,
    );

    const screensFile = join(directory, "screens.png");
    const paintsFile = join(directory, "paints.png");
    // oxlint-disable-next-line no-await-in-loop -- One sheet at a time in one browser.
    await shoot(browser, {
      file: screensFile,
      html: document(`${path}: every screen`, `<div class="row">${screens.join("")}</div>`),
    });
    // oxlint-disable-next-line no-await-in-loop -- One sheet at a time in one browser.
    await shoot(browser, {
      file: paintsFile,
      html: document(`${path}: every paint, by ms since the navigation started`, paints.join("")),
    });

    sheets.push(screensFile, paintsFile);
  }

  return sheets;
}

/** One image with every paint after each tap, in order, so a navigation is judged by what showed. */
export async function renderNavigationSheet(
  browser: Browser,
  { navigations, out }: { navigations: NavigationReport[]; out: string },
): Promise<string[]> {
  if (navigations.length === 0) {
    return [];
  }

  const hops = navigations.map(
    (hop) =>
      `<h2>${hop.from} → ${hop.to}, ${hop.viewport}</h2><div class="row">${hop.frames
        .map((ms) => figure("paint", `${ms} ms`, join(hop.framesDirectory, frameFile(ms))))
        .join("")}</div>`,
  );

  const file = join(out, "navigations", "paints.png");

  await shoot(browser, {
    file,
    html: document("Every paint after each tap, by ms since the tap", hops.join("")),
  });

  return [file];
}
