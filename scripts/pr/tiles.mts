/* oxlint-disable no-await-in-loop -- One picture at a time: a full-page shot decodes to tens of megabytes. */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import sharp from "sharp";
import { findManifests } from "./locate.mts";
import {
  type AlignmentReport,
  type ManifestItem,
  displayPath,
  fileName,
  isRecorded,
  pathWithin,
  readAlignment,
  readManifest,
} from "./media.mts";

/** Vision models shrink an image past about 1.15 megapixels or 1568 px on a side. */
const MAX_PIXELS = 1_150_000;
const MAX_SIDE = 1568;

/** Enough for a row cut by one tile's edge to show whole in the next. */
const OVERLAP = 96;

export type Tile = { height: number; left: number; top: number; width: number };

type Span = { size: number; start: number };

function spans(length: number, max: number): Span[] {
  if (length <= max) {
    return [{ size: length, start: 0 }];
  }

  const count = 1 + Math.ceil((length - max) / (max - OVERLAP));

  return Array.from({ length: count }, (_, index) => ({
    size: max,
    start: Math.round((index * (length - max)) / (count - 1)),
  }));
}

export function tileBoxes({ height, width }: { height: number; width: number }): Tile[] {
  const columns = spans(width, MAX_SIDE);
  const tileWidth = columns[0]?.size ?? width;
  const rows = spans(height, Math.min(MAX_SIDE, Math.floor(MAX_PIXELS / tileWidth)));

  return rows.flatMap((row) =>
    columns.map((column) => ({
      height: row.size,
      left: column.start,
      top: row.start,
      width: column.size,
    })),
  );
}

const VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".webm"]);

type Picture = { folder: string; id: string; item: ManifestItem; path: string };

type Measured = { folder: string; report: AlignmentReport };

async function collect(root: string): Promise<{ measured: Measured[]; pictures: Picture[] }> {
  const folders = await findManifests(root);

  const loaded = await Promise.all(
    folders.map(async (folder) => {
      const [report, items] = await Promise.all([readAlignment(folder), readManifest(folder)]);
      return { folder, items: items ?? [], report };
    }),
  );

  const pictures = loaded.flatMap(({ folder, items }) =>
    items.map((item) => {
      const path = resolve(folder, item.file);
      return { folder, id: pathWithin(root, path), item, path };
    }),
  );

  return { measured: loaded.map(({ folder, report }) => ({ folder, report })), pictures };
}

/** The after pictures a read covers, native ones still pending included. */
export async function readablePictures(root: string): Promise<Picture[]> {
  const { pictures } = await collect(root);
  return pictures.filter(({ item }) => item.side === "after");
}

function describeItem(item: ManifestItem): string {
  if (!isRecorded(item)) {
    return `${item.platform} · pending: no native capture record yet`;
  }

  return [
    item.kind === "shot" ? item.name : "video",
    item.platform,
    item.viewport,
    item.scheme,
    item.locale,
    `scale ${item.scale}`,
    `${item.pointer} pointer`,
    item.scenario && `scenario ${item.scenario}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function pairKey(item: ManifestItem): string | undefined {
  return isRecorded(item) && item.kind === "shot"
    ? [item.platform, item.name, item.viewport, item.scheme].join(" ")
    : undefined;
}

async function cutPicture({
  link,
  picture,
  sheet,
}: {
  link: (path: string) => string;
  picture: Picture;
  sheet: string;
}) {
  if (VIDEO_EXTENSIONS.has(extname(picture.path))) {
    return ["Watch it at full size: tiles aren't cut from a video."];
  }

  const image = sharp(picture.path);
  const { height, width } = await image.metadata();
  const tiles = tileBoxes({ height, width });
  const folder = join(sheet, "tiles", fileName(picture.id));
  await mkdir(folder, { recursive: true });

  const lines: string[] = [];

  for (const [index, tile] of tiles.entries()) {
    const path = join(folder, `${index + 1}.png`);
    await sharp(picture.path).extract(tile).png().toFile(path);

    lines.push(
      `![Tile ${index + 1} of ${tiles.length}: x ${tile.left}–${tile.left + tile.width}, y ${tile.top}–${tile.top + tile.height}](${link(path)})`,
    );
  }

  return [`${width}×${height} px, ${tiles.length} tiles at original size:`, "", ...lines];
}

function scenarioGroups(pictures: Picture[]): string[] {
  const named = pictures.filter(({ item }) => isRecorded(item) && item.scenario);

  if (named.length === 0) {
    return [
      "No scenario ids are recorded yet: group the wait and notice states by screen yourself.",
    ];
  }

  return [...Map.groupBy(named, ({ item }) => (isRecorded(item) ? item.scenario : ""))].flatMap(
    ([scenario, list]) => [
      `- ${scenario}: ${list.map(({ id, item }) => `${id} (${item.platform})`).join(", ")}`,
    ],
  );
}

/**
 * Cuts every after picture under `root` into original-size tiles and writes `READ.md` beside them:
 * the pictures first, then the numbers the checks recorded, then the words across platforms.
 */
export async function writeReadingSheet({ root, sheet }: { root: string; sheet: string }) {
  const { measured, pictures } = await collect(root);
  const after = pictures.filter(({ item }) => item.side === "after");

  const before = new Map(
    pictures
      .filter(({ item }) => item.side === "before")
      .flatMap((picture) => {
        const key = pairKey(picture.item);
        return key ? [[key, picture] as const] : [];
      }),
  );

  await rm(join(sheet, "tiles"), { force: true, recursive: true });
  const link = (path: string) => relative(sheet, path).replaceAll("\\", "/");
  const sections: string[] = [];

  for (const [index, picture] of after.entries()) {
    const key = pairKey(picture.item);
    const pair = key ? before.get(key) : undefined;

    sections.push(
      `## ${index + 1}. ${picture.id}`,
      "",
      describeItem(picture.item),
      "",
      `Whole screen: ![${picture.id}](${link(picture.path)})`,
      "",
      ...(await cutPicture({ link, picture, sheet })),
      "",
      ...(pair ? [`Before, for comparison: [${pair.id}](${link(pair.path)})`, ""] : []),
    );
  }

  const numbers = measured.flatMap(({ folder, report }) =>
    (report.findings ?? []).map(
      (finding) => `- ${pathWithin(root, folder)} · ${finding.level}: ${finding.message}`,
    ),
  );

  const markdown = [
    `# Read ${after.length === 1 ? "this picture" : `these ${after.length} pictures`}`,
    "",
    "Read them as someone who built none of it. For each picture, look at the whole screen, then every tile at original size, and write down what is off before you look at any numbers: edges that don't line up, uneven gaps, room left empty, text cut off or crowded, two filled buttons on one surface, words someone new to Zoonk wouldn't know. Crop at 3× only for a small doubt, and keep an unmarked copy beside any overlay.",
    "",
    ...sections,
    "## Then the numbers",
    "",
    "Reconcile what you wrote with what the checks measured. Keep what you saw that they missed.",
    "",
    ...(numbers.length > 0 ? numbers : ["No alignment.json beside these captures yet."]),
    "",
    "## Then the words",
    "",
    "- List every question a page asks together, apart from their answers, and check they read as one set.",
    "- For each wait or notice state, put its words from every platform side by side. The meaning must match; each platform may phrase it its own way.",
    "",
    ...scenarioGroups(after),
    "",
    "## Record the read",
    "",
    "```sh",
    `pnpm pr:media read --by "<who read>" --findings <findings.json> ${displayPath(root)}`,
    "```",
    "",
    'Each finding is `{ "file": "<a picture as listed above>", "text": "<what is off>" }` in a JSON array. Leave out `--findings` for a clean read. Each finding gets an id; resolve it later with `pnpm pr:media resolve <id> --fixed <commit>` or, for an exception the user granted, `--exception "<who granted it>"`.',
    "",
  ].join("\n");

  await mkdir(sheet, { recursive: true });
  await writeFile(join(sheet, "READ.md"), markdown);
  return { count: after.length, path: join(sheet, "READ.md") };
}
