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

/** `unsupported` holds media written any other way, so it fails instead of going unchecked. */
export function bodyMedia(markdown: string): { pictures: string[]; unsupported: string[] } {
  const pictures = [...markdown.matchAll(PICTURE)].map((match) => match.groups?.path ?? "");

  const { found } = OTHER_MEDIA.reduce(
    ({ found: earlier, rest }, pattern) => ({
      found: [...earlier, ...[...rest.matchAll(pattern)].map((match) => match[0].trim())],
      rest: rest.replaceAll(pattern, " "),
    }),
    { found: new Array<string>(), rest: markdown.replaceAll(PICTURE, " ") },
  );

  return { pictures: [...new Set(pictures)], unsupported: [...new Set(found)] };
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
