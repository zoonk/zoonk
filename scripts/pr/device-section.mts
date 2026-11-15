import { resolve } from "node:path";
import { manifestsAbove } from "./locate.mts";
import { type CaptureItem, deviceLine, isRecorded, readManifest } from "./media.mts";
import { sha256File } from "./provenance.mts";

/**
 * The heading over the device pictures, so whoever reads the PR sees nothing measured their
 * layout: a picture taken from a simulator or an emulator, which no capture reads.
 */
const DEVICE_HEADING = "On a device (layout not measured)";

/** Words that stay words in a table cell and an image's description: no markup, one line. */
export const PLAIN_WORDS = /^[^\n\r*<>[\\\]_`|~]+$/u;

/** A phone's picture three to a row reads at about 280 px wide in a PR's column. */
const COLUMNS = 3;

export type DeviceShot = { item: CaptureItem; link: string };

/** What the picture shows, as it was named when it was taken. */
function showsOf(item: CaptureItem): string {
  return item.shows ?? (item.kind === "shot" ? item.name.replaceAll("-", " ") : "Device picture");
}

function row(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function table(shots: DeviceShot[]): string {
  return [
    row(shots.map(({ item }) => showsOf(item))),
    row(shots.map(() => "---")),
    row(shots.map(({ item, link }) => `![${showsOf(item)}](${link})`)),
    row(shots.map(({ item }) => deviceLine(item))),
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

/** The device pictures named, by their links from the working directory, with their records. */
export async function readDeviceShots(links: string[]): Promise<DeviceShot[]> {
  return Promise.all(
    links.map(async (link) => {
      const path = resolve(link);
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
