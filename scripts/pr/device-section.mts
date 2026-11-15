import { resolve } from "node:path";
import { manifestsAbove } from "./locate.mts";
import { type CaptureItem, deviceLine, isRecorded, readManifest } from "./media.mts";
import { sha256File } from "./provenance.mts";

/**
 * The heading over the device pictures, so whoever reads the PR sees nothing measured their
 * layout: a picture taken from a simulator or an emulator, which no capture reads.
 */
const DEVICE_HEADING = "On a device (layout not measured)";

/**
 * What GitHub links even escaped, notifying that person or leaving a cross-reference on that issue:
 * an @name, a #number, a GH-number, an issue's, pull request's or discussion's URL. A commit's
 * hash links too, to the commit, and is fine.
 */
export const REFERENCE = /@\w|#\d|\bgh-\d|\/(?:issues|pull|discussions)\/\d/iu;

/** What an image's path may not hold: anything but a letter or a digit of any script, `/`, `.`, `-` and `_`. */
const NOT_IN_PATH = /[^\p{L}\p{M}\p{N}/._-]/u;

/**
 * Any text as literal words in a table cell or an image's description: every ASCII punctuation
 * character escaped, as CommonMark allows, and line breaks folded into a space.
 */
function literal(text: string): string {
  return text
    .replaceAll(/\s+/gu, " ")
    .trim()
    .replaceAll(/[!-/:-@[-`{-~]/gu, (mark) => `\\${mark}`);
}

/** Why a picture's path can't go in a PR body as an image, or null when it can. */
export function unwritablePath(path: string): string | null {
  const [found] = NOT_IN_PATH.exec(path) ?? [];

  if (found === undefined) {
    return null;
  }

  const what = /\s/u.test(found) ? "a space" : `"${found}"`;
  return `${path} has ${what}, which a PR body can't hold in an image's path: pick another folder.`;
}

/** The first of each picture, by the path it resolves to, in order. */
export function firstOfEach<Shown extends { path: string }>(shown: Shown[]): Shown[] {
  return shown.filter((item, index) => shown.findIndex(({ path }) => path === item.path) === index);
}

/** A phone's picture three to a row reads at about 280 px wide in a PR's column. */
const COLUMNS = 3;

export type DeviceShot = { item: CaptureItem; link: string };

/** What the picture shows, as it was named when it was taken. */
function showsOf(item: CaptureItem): string {
  return item.shows ?? (item.kind === "shot" ? item.name.replaceAll("-", " ") : "Device picture");
}

/**
 * Every word a device picture's caption prints: what it shows, then what was verified of it. The
 * writer prints these and the device command refuses a reference in them, from this one list.
 */
export function captionWords(item: CaptureItem): [shows: string, verified: string] {
  return [showsOf(item), deviceLine(item)];
}

function row(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function table(shots: DeviceShot[]): string {
  const captions = shots.map(({ item, link }) => {
    const [shows, verified] = captionWords(item);
    return { link, shows: literal(shows), verified: literal(verified) };
  });

  return [
    row(captions.map(({ shows }) => shows)),
    row(shots.map(() => "---")),
    row(captions.map(({ link, shows }) => `![${shows}](${link})`)),
    row(captions.map(({ verified }) => verified)),
  ].join("\n");
}

/**
 * The PR body's device section, written whole from the pictures' records: the heading, then the
 * pictures three to a table, each with what it shows and what was verified of it.
 */
export function deviceSection(shots: DeviceShot[]): string {
  const tables = Array.from({ length: Math.ceil(shots.length / COLUMNS) }, (_, index) =>
    table(shots.slice(index * COLUMNS, (index + 1) * COLUMNS)),
  );

  return [`## ${DEVICE_HEADING}`, ...tables].join("\n\n");
}

/**
 * Where the body holds `section` as whole lines between blank lines (or the body's ends): its
 * start, or null unless it does so exactly once.
 */
export function sectionStart(markdown: string, section: string): number | null {
  const padded = `\n\n${markdown}\n\n`;
  const fenced = `\n\n${section}\n\n`;
  const first = padded.indexOf(fenced);
  return first !== -1 && !padded.includes(fenced, first + 1) ? first : null;
}

/**
 * The device pictures named, by their links from the working directory, each once, with their
 * records. A link a body can't hold is refused.
 */
export async function readDeviceShots(links: string[]): Promise<DeviceShot[]> {
  const unwritable = links.map((link) => unwritablePath(link)).find((why) => why !== null);

  if (unwritable) {
    throw new Error(unwritable);
  }

  const named = firstOfEach(links.map((link) => ({ link, path: resolve(link) })));

  return Promise.all(
    named.map(async ({ link, path }) => {
      const sha256 = await sha256File(path);
      const folders = manifestsAbove([path]);
      const items = await Promise.all(folders.map(async (folder) => readManifest(folder)));

      const item = items
        .flat()
        .find((found) => found && isRecorded(found) && found.device && found.sha256 === sha256);

      if (!item || !isRecorded(item)) {
        throw new Error(`${link} has no device record: take it with pnpm pr:media device.`);
      }

      return { item, link };
    }),
  );
}
