import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Scheme, type ViewportName } from "../verify/viewports.mts";

export const SIDES = ["before", "after"] as const;
export type Side = (typeof SIDES)[number];

/** `file` is relative to its side's folder, with forward slashes, since Markdown links use it. */
export type CaptureItem =
  | { file: string; kind: "shot"; name: string; scheme: Scheme; viewport: ViewportName }
  | { file: string; kind: "video"; scheme: Scheme; viewport: ViewportName };

export const MANIFEST = "capture.json";

const SIDE_LABEL: Record<Side, string> = { after: "After", before: "Before" };

/** Lowercase letters and digits joined by hyphens: safe as a file name and inside a Markdown link. */
export function fileName(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

export function pathShotName(path: string): string {
  return fileName(new URL(path, "http://localhost").pathname) || "home";
}

export async function readCapture(folder: string): Promise<CaptureItem[] | undefined> {
  const manifest = join(folder, MANIFEST);

  if (!existsSync(manifest)) {
    return undefined;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This script's own manifest.
  return JSON.parse(await readFile(manifest, "utf8")) as CaptureItem[];
}

export type Sides = Partial<Record<Side, CaptureItem[]>>;

type Pair = Partial<Record<Side, CaptureItem>> & { name: string; row: string; screen: string };

function screenOf(item: CaptureItem): string {
  return `${item.viewport} · ${item.scheme}`;
}

function rowOf(item: CaptureItem): string {
  return item.kind === "shot" ? `${item.name} · ${screenOf(item)}` : screenOf(item);
}

export function pairItems(sides: Sides, kind: CaptureItem["kind"]): Pair[] {
  const pairs = new Map<string, Pair>();

  for (const side of ["after", "before"] as const) {
    for (const item of sides[side] ?? []) {
      if (item.kind === kind) {
        const row = rowOf(item);
        const name = item.kind === "shot" ? item.name : "Video";
        pairs.set(row, { name, row, screen: screenOf(item), ...pairs.get(row), [side]: item });
      }
    }
  }

  return [...pairs.values()];
}

/** Each video stands alone in its paragraph: GitHub plays a video only there. */
export function renderMedia({
  root,
  sides,
  unchanged = new Set(),
}: {
  root: string;
  sides: Sides;
  unchanged?: ReadonlySet<string>;
}): { attachments: string[]; markdown: string } {
  const link = (side: Side, item: CaptureItem) => `${root}/${side}/${item.file}`;
  const shots = pairItems(sides, "shot").filter((pair) => !unchanged.has(pair.row));
  const videos = pairItems(sides, "video");

  const image = (side: Side, pair: Pair) => {
    const item = pair[side];
    return item ? `![${SIDE_LABEL[side]}: ${pair.row}](${link(side, item)})` : "–";
  };

  const screenPanels = [...Map.groupBy(shots, (pair) => pair.name)].map(([name, pairs]) => ({
    body: [
      "| | Before | After |",
      "| --- | --- | --- |",
      ...pairs.map(
        (pair) => `| ${pair.screen} | ${image("before", pair)} | ${image("after", pair)} |`,
      ),
      "",
    ],
    summary: name,
  }));

  const videoPanels = videos.map((pair) => ({
    body: SIDES.flatMap((side) => {
      const item = pair[side];
      return item ? [`**${SIDE_LABEL[side]}**`, "", `![](${link(side, item)})`, ""] : [];
    }),
    summary: `${pair.name} · ${pair.screen}`,
  }));

  const panels = [...screenPanels, ...videoPanels].flatMap(({ body, summary }, index) => [
    index === 0 ? "<details open>" : "<details>",
    `<summary>${summary}</summary>`,
    "",
    ...body,
    "</details>",
    "",
  ]);

  const attachments = [...shots, ...videos].flatMap((pair) =>
    SIDES.flatMap((side) => {
      const item = pair[side];
      return item ? [link(side, item)] : [];
    }),
  );

  return { attachments, markdown: ["## Before and after", "", ...panels].join("\n") };
}
