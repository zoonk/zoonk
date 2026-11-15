import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { MANIFEST } from "./media.mts";

export function isRemote(picture: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//iu.test(picture);
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
