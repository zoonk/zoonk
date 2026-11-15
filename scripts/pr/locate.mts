import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { MANIFEST } from "./media.mts";

export function isRemote(picture: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//iu.test(picture);
}

/** The one form the check reads: `![description](path "optional title")`, the path unspaced. */
const PICTURE = /!\[[^\]]*\]\((?<path>[^\s()<>]+)(?:\s+"[^"]*")?\)/gu;

/** Every other way a body can show media, taken out in turn so each shows up once. */
const OTHER_MEDIA = [
  /<(?:audio|img|picture|source|video)\b[^>]*>/giu,
  /!\[[^\]]*\](?:\[[^\]]*\]|\([^)]*\))?/gu,
  /^ {0,3}\[[^\]]+\]:\s*\S+/gmu,
  /\S+\.(?:avif|gif|jpe?g|mov|mp4|png|svg|webm|webp)\b/giu,
];

/**
 * The one heading device pictures go under, so whoever reads the PR sees nothing measured their
 * layout: a picture taken from a simulator or an emulator, which no capture reads.
 */
export const DEVICE_HEADING = "On a device (layout not measured)";

const HEADING = /^ {0,3}(?<marks>#{1,6})\s+(?<text>.*?)(?:\s+#+)?\s*$/u;

export type DevicePicture = { caption: string; path: string };

/** Whether each line sits under the device heading, which lasts until a heading as high as it. */
function underDeviceHeading(lines: string[]): boolean[] {
  return lines.reduce<{ level: number; under: boolean[] }>(
    ({ level, under }, line) => {
      const heading = HEADING.exec(line)?.groups;

      if (!heading) {
        return { level, under: [...under, level > 0] };
      }

      const depth = heading.marks?.length ?? 0;

      if (heading.text === DEVICE_HEADING) {
        return { level: depth, under: [...under, false] };
      }

      const inside = level > 0 && depth > level;
      return { level: inside ? level : 0, under: [...under, inside] };
    },
    { level: 0, under: [] },
  ).under;
}

/** A device picture's caption: the rest of its line, or else the next line with text. */
function captionOf(lines: string[], line: number, rest: string): string {
  const text = rest.trim() || lines.slice(line + 1).find((next) => next.trim()) || "";
  return text.replaceAll(/^[\s*_]+|[\s*_]+$/gu, "");
}

/**
 * `onDevice` holds the pictures under the device heading with their captions, and `unsupported`
 * media written any other way, so it fails instead of going unchecked.
 */
export function bodyMedia(markdown: string): {
  onDevice: DevicePicture[];
  pictures: string[];
  unsupported: string[];
} {
  const lines = markdown.split("\n");
  const under = underDeviceHeading(lines);

  const found = [...markdown.matchAll(PICTURE)].map((match) => {
    const line = markdown.slice(0, match.index).split("\n").length - 1;
    const end = match.index + match[0].length;
    const rest = markdown.slice(end, markdown.indexOf("\n", end) + 1 || undefined);
    return { line, path: match.groups?.path ?? "", rest };
  });

  const outside = found.filter(({ line }) => !under[line]).map(({ path }) => path);

  const onDevice = found
    .filter(({ line }) => under[line])
    .filter(({ path }, index, all) => all.findIndex((first) => first.path === path) === index)
    .map(({ line, path, rest }) => ({ caption: captionOf(lines, line, rest), path }));

  const { found: other } = OTHER_MEDIA.reduce(
    ({ found: earlier, rest }, pattern) => ({
      found: [...earlier, ...[...rest.matchAll(pattern)].map((match) => match[0].trim())],
      rest: rest.replaceAll(pattern, " "),
    }),
    { found: new Array<string>(), rest: markdown.replaceAll(PICTURE, " ") },
  );

  return { onDevice, pictures: [...new Set(outside)], unsupported: [...new Set(other)] };
}

function foldersAbove(folder: string): string[] {
  const parent = dirname(folder);
  return parent === folder ? [folder] : [folder, ...foldersAbove(parent)];
}

/** A manifest sits in a folder above its pictures, so the check needn't search a whole tree. */
export function manifestsAbove(pictures: string[]): string[] {
  const folders = pictures
    .filter((picture) => !isRemote(picture))
    .flatMap((picture) => foldersAbove(dirname(picture)));

  return [...new Set(folders)].filter((folder) => existsSync(join(folder, MANIFEST)));
}

const SKIPPED = new Set([".git", "node_modules"]);

export async function findManifests(root: string): Promise<string[]> {
  if (!existsSync(root)) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const here = entries.some((entry) => entry.isFile() && entry.name === MANIFEST) ? [root] : [];

  const below = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !SKIPPED.has(entry.name))
      .map(async (entry) => findManifests(join(root, entry.name))),
  );

  return [...here, ...below.flat()].toSorted();
}
