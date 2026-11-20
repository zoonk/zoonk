import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { type ScreenSnapshot, type StoredScreens } from "./schema";

export async function checkScreenReferences(
  db: TransactionClient,
  {
    before,
    after,
    mediaLinks = [],
    newItems,
    problems,
  }: Pick<StoredScreens, "before" | "after" | "newItems"> & {
    mediaLinks?: StoredScreens["mediaLinks"];
    problems: string[];
  },
) {
  const mediaIds = after.screens.flatMap((screen) => [
    ...(screen.mediaAssetId ? [screen.mediaAssetId] : []),
    ...screen.optionPictures.map(({ mediaAssetId }) => mediaAssetId),
  ]);

  const sourceIds = after.screens.flatMap((screen) => [
    ...(screen.sourceId ? [screen.sourceId] : []),
    ...screen.sources.map(({ sourceId }) => sourceId),
  ]);

  const itemIds = after.screens.flatMap(({ itemId }) =>
    itemId && !newItems.some(({ id }) => id === itemId) ? [itemId] : [],
  );

  const [media, sources, items, words, sentences] = await Promise.all([
    mediaIds.length > 0
      ? db.mediaAsset.findMany({
          select: { checkOwedAt: true, id: true },
          where: { id: { in: mediaIds }, kind: "image", ownerId: null, visibility: "public" },
        })
      : [],
    sourceIds.length > 0
      ? db.source.findMany({
          select: { id: true },
          where: { id: { in: sourceIds }, ownerId: null, visibility: "public" },
        })
      : [],
    itemIds.length > 0
      ? db.item.findMany({ select: { id: true }, where: { id: { in: itemIds } } })
      : [],
    after.words.length > 0
      ? db.word.findMany({ where: { id: { in: after.words.map(({ id }) => id) } } })
      : [],
    after.sentences.length > 0
      ? db.sentence.findMany({ where: { id: { in: after.sentences.map(({ id }) => id) } } })
      : [],
  ]);

  const keptMedia = new Set(
    before.screens.flatMap((screen) => [
      screen.mediaAssetId,
      ...screen.optionPictures.map(({ mediaAssetId }) => mediaAssetId),
    ]),
  );

  for (const [index, screen] of after.screens.entries()) {
    const path = `screens[${String(index)}]`;

    if (
      [screen.mediaAssetId, ...screen.optionPictures.map((row) => row.mediaAssetId)].some(
        (id) =>
          id &&
          !media.some((row) => row.id === id && (keptMedia.has(id) || row.checkOwedAt === null)),
      )
    ) {
      problems.push(
        `${path}.mediaAssetId: choose an existing public picture that has passed its check.`,
      );
    }

    if (
      [screen.sourceId, ...screen.sources.map((row) => row.sourceId)].some(
        (id) => id && !sources.some((row) => row.id === id),
      )
    ) {
      problems.push(`${path}.citation: choose an existing public source.`);
    }

    if (
      screen.itemId &&
      !items.some((row) => row.id === screen.itemId) &&
      !newItems.some((row) => row.id === screen.itemId)
    ) {
      problems.push(`${path}.itemId: the linked practice item is missing. Replace this check.`);
    }
  }

  const created = new Set(
    mediaLinks.flatMap((link) => ("create" in link && link.create ? [link.id] : [])),
  );

  for (const [index, word] of after.words.entries()) {
    if (
      !created.has(word.id) &&
      !words.some(
        (row) =>
          row.id === word.id &&
          row.word === word.word &&
          row.audioUrl === word.audioUrl &&
          row.romanization === word.romanization,
      )
    ) {
      problems.push(
        `words[${String(index)}]: the word or recording changed. Review the current shared word.`,
      );
    }
  }

  for (const [index, sentence] of after.sentences.entries()) {
    if (
      !created.has(sentence.id) &&
      !sentences.some(
        (row) =>
          row.id === sentence.id &&
          row.sentence === sentence.sentence &&
          row.audioUrl === sentence.audioUrl &&
          row.romanization === sentence.romanization,
      )
    ) {
      problems.push(
        `sentences[${String(index)}]: the sentence or recording changed. Review the current shared sentence.`,
      );
    }
  }
}

export function changedRows(
  before: ScreenSnapshot["words"] | ScreenSnapshot["sentences"],
  after: ScreenSnapshot["words"] | ScreenSnapshot["sentences"],
) {
  return before
    .filter((row) => !after.some((next) => next.id === row.id && isDeepStrictEqual(next, row)))
    .map(({ id }) => id);
}

export function screenItemIds(snapshot: ScreenSnapshot): string[] {
  return snapshot.screens.flatMap(({ itemId }) => itemId ?? []);
}
