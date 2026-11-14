/* oxlint-disable no-await-in-loop -- Each crop and sheet is captured in one browser, in order. */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { type Browser, type Page } from "@playwright/test";
import { slug } from "./measure.mts";
import { OVERLAYS } from "./overlays.mts";
import { redactQuery } from "./requests.mts";
import { type RoleSample, readRoles } from "./roles-probe.mts";

export type RoleCapture = RoleSample & {
  path: string;
  viewport: string;
  state: string;
  file: string;
};

const ROLES = [
  "page-top",
  "back-link",
  "bottom-bar",
  "overlay",
  "subscription-gate",
  "empty",
  "eyebrow",
  "tabs",
  "list-tail",
];

const METRICS = ["top", "height", "gap", "glyph", "label"] as const;
type Metric = (typeof METRICS)[number];

function metric(sample: RoleCapture, key: Metric): string {
  if (key === "top") {
    return String(Math.round(sample.box.y));
  }

  if (key === "height") {
    return String(Math.round(sample.box.height));
  }

  return String(sample[key] ?? "not measured");
}

function common(samples: RoleCapture[], key: Metric) {
  const groups = Map.groupBy(samples, (sample) => metric(sample, key));
  return [...groups].toSorted((a, b) => b[1].length - a[1].length)[0]?.[0];
}

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function roleSheetHtml({
  role,
  viewport,
  paths,
  captures,
}: {
  role: string;
  viewport: string;
  paths: string[];
  captures: RoleCapture[];
}): string {
  const samples = captures.filter((sample) => sample.role === role && sample.viewport === viewport);
  const modes = Object.fromEntries(METRICS.map((key) => [key, common(samples, key)]));

  const rows = paths
    .flatMap((path) => {
      const here = samples.filter((sample) => sample.path === path);

      if (here.length === 0) {
        return [
          `<tr><th>${escape(path)}</th><td colspan="6">No visible slot in captured states</td></tr>`,
        ];
      }

      return here.map(
        (sample) =>
          `<tr><th>${escape(path)}<br>${escape(sample.state)} #${sample.index + 1}</th><td><img src="${escape(pathToFileURL(sample.file).href)}"></td>${METRICS.map(
            (key) => {
              const value = metric(sample, key);
              return `<td${value === modes[key] ? "" : ' class="diff"'}>${escape(value)}</td>`;
            },
          ).join("")}</tr>`,
      );
    })
    .join("");

  return `<!doctype html><meta charset="utf-8"><title>${escape(role)} (${escape(viewport)})</title><style>body{font:13px system-ui;background:white;color:#111;margin:16px}table{border-collapse:collapse}td,th{padding:8px;border:1px solid #ccc;vertical-align:top;text-align:left}img{display:block;max-width:650px;max-height:350px}.diff{background:#fff0b3}h1{font-size:18px}</style><h1>${escape(role)} (${escape(viewport)})</h1><p>Yellow cells differ from the most common value. Ties use the first captured value. Numbers are CSS px; gap is computed column-gap; glyph is the first SVG's box. Crops show the visible viewport portion. Differences are comparisons, not failures.</p><table><thead><tr><th>Page / state</th><th>Crop</th>${METRICS.map((key) => `<th>${key}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
}

export async function captureRoles(
  page: Page,
  { out, path, viewport, state }: { out: string; path: string; viewport: string; state: string },
): Promise<RoleCapture[]> {
  const directory = join(out, "roles", slug(path), viewport);
  await mkdir(directory, { recursive: true });
  const samples = await page.evaluate(readRoles, OVERLAYS);
  const captures: RoleCapture[] = [];

  for (const sample of samples.filter((entry) => state === "page" || entry.role === "overlay")) {
    const file = join(directory, `${slug(state)}-${sample.role}-${sample.index}.png`);
    await page.screenshot({ clip: sample.box, path: file, scale: "css" });
    captures.push({ ...sample, file, path: redactQuery(path), state, viewport });
  }

  return captures;
}

export async function renderRoleSheets(
  browser: Browser,
  {
    out,
    paths,
    viewports,
    captures,
  }: { out: string; paths: string[]; viewports: string[]; captures: RoleCapture[] },
): Promise<string[]> {
  const directory = join(out, "roles");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "measurements.json"), JSON.stringify(captures, null, 2));
  const page = await browser.newPage({ viewport: { height: 900, width: 1600 } });
  const files: string[] = [];

  try {
    for (const viewport of viewports) {
      for (const role of ROLES) {
        const source = join(directory, `${role}-${viewport}.html`);
        const file = join(directory, `${role}-${viewport}.png`);

        await writeFile(
          source,
          roleSheetHtml({
            captures,
            paths: paths.map((path) => redactQuery(path)),
            role,
            viewport,
          }),
        );

        await page.goto(pathToFileURL(source).href);
        await page.screenshot({ fullPage: true, path: file });
        files.push(file);
      }
    }
  } finally {
    await page.close();
  }

  return files;
}
