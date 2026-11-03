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

function screenOf(item: CaptureItem): string {
  return `${item.viewport} · ${item.scheme}`;
}

function rowOf(item: CaptureItem): string {
  return item.kind === "shot" ? `${item.name} · ${screenOf(item)}` : screenOf(item);
}

/** Each video stands alone in its paragraph: GitHub plays a video only there. */
export function renderMedia({
  root,
  sides,
}: {
  root: string;
  sides: Partial<Record<Side, CaptureItem[]>>;
}): { attachments: string[]; markdown: string } {
  const all = [...(sides.after ?? []), ...(sides.before ?? [])];
  const link = (side: Side, item: CaptureItem) => `${root}/${side}/${item.file}`;

  const find = (side: Side, kind: CaptureItem["kind"], row: string) =>
    sides[side]?.find((item) => item.kind === kind && rowOf(item) === row);

  const rows = (kind: CaptureItem["kind"]) => [
    ...new Set(all.filter((item) => item.kind === kind).map((item) => rowOf(item))),
  ];

  const shots = rows("shot").map((row) =>
    SIDES.map((side) => ({ item: find(side, "shot", row), row, side })),
  );

  const videos = rows("video").flatMap((row) =>
    SIDES.map((side) => ({ item: find(side, "video", row), row, side })),
  );

  const cell = ({ item, row, side }: { item?: CaptureItem; row: string; side: Side }) =>
    item ? `![${SIDE_LABEL[side]}: ${row}](${link(side, item)})` : "–";

  const table =
    shots.length > 0
      ? [
          "| Screen | Before | After |",
          "| --- | --- | --- |",
          ...shots.map(
            (pair) => `| ${pair[0]?.row} | ${pair.map((side) => cell(side)).join(" | ")} |`,
          ),
          "",
        ]
      : [];

  const players = videos.flatMap(({ item, row, side }) =>
    item ? [`**${SIDE_LABEL[side]}** · ${row}`, "", `![](${link(side, item)})`, ""] : [],
  );

  const attachments = [...shots.flat(), ...videos].flatMap(({ item, side }) =>
    item ? [link(side, item)] : [],
  );

  return { attachments, markdown: ["## Before and after", "", ...table, ...players].join("\n") };
}
