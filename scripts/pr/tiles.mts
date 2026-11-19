/* oxlint-disable no-await-in-loop -- One picture at a time: a full-page shot decodes to tens of megabytes. */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import sharp from "sharp";
import { findManifests } from "./locate.mts";
import {
  type AlignmentReport,
  type Finding,
  type ManifestItem,
  type Retake,
  displayPath,
  fileName,
  isRecorded,
  pathWithin,
  readAlignment,
  readManifest,
  readOf,
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

async function pictureSection({
  heading,
  link,
  picture,
  sheet,
}: {
  heading: string;
  link: (path: string) => string;
  picture: Picture;
  sheet: string;
}): Promise<string[]> {
  return [
    `## ${heading}`,
    "",
    describeItem(picture.item),
    "",
    `Whole screen: ![${picture.id}](${link(picture.path)})`,
    "",
    ...(await cutPicture({ link, picture, sheet })),
    "",
  ];
}

/** The reader's sort of a finding, which a fault still there keeps. */
function marksOf({ before, misleads, rule }: Finding): string {
  return rule === undefined ? "" : ` (rule ${rule}, before ${before}, misleads ${misleads})`;
}

/** A retake's section: the picture, the one read before it and the findings fixed since. */
async function fixesSection({
  link,
  picture,
  retakes,
  sheet,
}: {
  link: (path: string) => string;
  picture: Picture;
  retakes: Retake;
  sheet: string;
}): Promise<string[]> {
  const fixed = retakes.read.findings.filter((finding) => finding.state === "fixed");
  const earlier = resolve(picture.folder, retakes.file);

  return [
    ...(await pictureSection({ heading: `Fixed: ${picture.id}`, link, picture, sheet })),
    `Read before: ![${picture.id}, read before](${link(earlier)})`,
    "",
    ...(fixed.length > 0
      ? ["Fixed since:", ...fixed.map((finding) => `- ${finding.text}${marksOf(finding)}`)]
      : ["Nothing was fixed since: say only whether anything got worse."]),
    "",
  ];
}

/** The blind pass over pictures nobody read: pictures, numbers, words, then the sort. */
async function blindPart({
  blind,
  link,
  pictures,
  root,
  measured,
  sheet,
}: {
  blind: Picture[];
  link: (path: string) => string;
  measured: Measured[];
  pictures: Picture[];
  root: string;
  sheet: string;
}): Promise<string[]> {
  if (blind.length === 0) {
    return [];
  }

  const before = new Map(
    pictures
      .filter(({ item }) => item.side === "before")
      .flatMap((picture) => {
        const key = pairKey(picture.item);
        return key ? [[key, picture] as const] : [];
      }),
  );

  const sections: string[] = [];

  for (const [index, picture] of blind.entries()) {
    sections.push(
      ...(await pictureSection({ heading: `${index + 1}. ${picture.id}`, link, picture, sheet })),
    );
  }

  const befores = blind.map((picture) => {
    const key = pairKey(picture.item);
    const pair = key ? before.get(key) : undefined;

    return pair
      ? `- ${picture.id}: [${pair.id}](${link(pair.path)})`
      : `- ${picture.id}: no before, so everything on it is this change's`;
  });

  const numbers = measured.flatMap(({ folder, report }) =>
    (report.findings ?? []).map(
      (finding) => `- ${pathWithin(root, folder)} · ${finding.level}: ${finding.message}`,
    ),
  );

  return [
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
    ...scenarioGroups(blind),
    "",
    "## Then sort each finding",
    "",
    "Only now open the before pictures. For each finding, mark whether the before picture shows it too, and whether it stops or misleads a learner: wrong or missing information, an action they can't find or use, text cut so the meaning is lost.",
    "",
    ...befores,
    "",
  ];
}

/**
 * Cuts every after picture under `root` that needs a read into original-size tiles and writes
 * `READ.md` beside them. A picture nobody read gets the blind pass, then the sort; a retake gets
 * only the check of its fixes against the picture read before.
 */
export async function writeReadingSheet({ root, sheet }: { root: string; sheet: string }) {
  const { measured, pictures } = await collect(root);
  const unread = pictures.filter(({ item }) => item.side === "after" && !readOf(item));

  const retaken = unread.flatMap((picture) => {
    const retakes = "retakes" in picture.item ? picture.item.retakes : undefined;
    return retakes ? [{ picture, retakes }] : [];
  });

  const blind = unread.filter(({ item }) => !("retakes" in item && item.retakes));

  await rm(join(sheet, "tiles"), { force: true, recursive: true });
  const link = (path: string) => relative(sheet, path).replaceAll("\\", "/");
  const fixes: string[] = [];

  for (const { picture, retakes } of retaken) {
    fixes.push(...(await fixesSection({ link, picture, retakes, sheet })));
  }

  const markdown = [
    `# Read ${unread.length === 1 ? "this picture" : `these ${unread.length} pictures`}`,
    "",
    ...(await blindPart({ blind, link, measured, pictures, root, sheet })),
    ...(fixes.length > 0
      ? [
          "## Check the fixes",
          "",
          'Each picture below retakes one that was read. Answer only two things: is each fixed finding gone, and is anything else on the screen worse than in the picture read before? Nothing else is a finding here. Write a fault still there as a finding again, with its marks; one the fix made is a finding with "before": false.',
          "",
          ...fixes,
        ]
      : []),
    "## Record the read",
    "",
    "```sh",
    `pnpm pr:media read --by "<who read>" --findings <findings.json> ${displayPath(root)}`,
    "```",
    "",
    'Each finding is `{ "file": "<a picture as listed above>", "text": "<what is off>", "rule": "<craft rule id, or none>", "before": <true or false>, "misleads": <true or false> }` in a JSON array. Leave out `--findings` for a clean read.',
    "",
  ].join("\n");

  await mkdir(sheet, { recursive: true });
  await writeFile(join(sheet, "READ.md"), markdown);

  // A retake of a read that itself checked a fix would be a third round.
  const third = retaken.filter(({ retakes }) => retakes.read.retake).length;
  return { count: unread.length, path: join(sheet, "READ.md"), third };
}
