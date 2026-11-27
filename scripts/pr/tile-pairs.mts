import { basename, dirname } from "node:path";
import { type ManifestItem, isRecorded } from "./media.mts";

export type Picture = { folder: string; id: string; item: ManifestItem; path: string };

function captureGroup({ folder, item }: Picture): string {
  return basename(folder) === item.side ? dirname(folder) : folder;
}

function pairKey(picture: Picture): string | undefined {
  const { item } = picture;

  return isRecorded(item) && item.kind === "shot"
    ? JSON.stringify([
        captureGroup(picture),
        item.platform,
        item.name,
        item.scenario,
        item.viewport,
        item.scheme,
        item.locale,
        item.scale,
        item.pointer,
      ])
    : undefined;
}

export function sortPictures({
  blind,
  link,
  pictures,
}: {
  blind: Picture[];
  link: (path: string) => string;
  pictures: Picture[];
}): string[] {
  const befores = pictures.filter(({ item }) => item.side === "before");
  const byScene = Map.groupBy(befores, pairKey);

  const afterScenes = new Set(
    pictures.filter(({ item }) => item.side === "after").map((picture) => pairKey(picture)),
  );

  return blind.map((picture) => {
    const key = pairKey(picture);
    const matches = byScene.get(key) ?? [];
    const [pair] = matches;

    if (key !== undefined && matches.length === 1 && pair) {
      return `- ${picture.id}: [${pair.id}](${link(pair.path)})`;
    }

    const sameGroup = befores.filter((before) => {
      const beforeKey = pairKey(before);

      return (
        captureGroup(before) === captureGroup(picture) &&
        before.item.platform === picture.item.platform &&
        (beforeKey === undefined || beforeKey === key || !afterScenes.has(beforeKey))
      );
    });

    if (sameGroup.length === 0) {
      return `- ${picture.id}: no before, so everything on it is this change's`;
    }

    const candidates = sameGroup.map(({ id, path }) => `[${id}](${link(path)})`).join(", ");
    return `- ${picture.id}: compare with the one that shows this screen, if present: ${candidates}`;
  });
}
