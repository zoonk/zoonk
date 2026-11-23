import { isDeepStrictEqual } from "node:util";
import { type StoredChange } from "@zoonk/core/staff/content-fixes/contract";
import { listContentValueChanges } from "@zoonk/core/staff/content-fixes/screen-content-rules";
import { isJsonObject } from "@zoonk/utils/json";

export type StoredScreens = Extract<StoredChange, { op: "setScreens" }>;
export type ScreenSnapshot = StoredScreens["before"];
export type SnapshotScreen = ScreenSnapshot["screens"][number];
type SnapshotVariant = SnapshotScreen["variants"][number];
type VariantEdit = { after: SnapshotVariant; before: SnapshotVariant };

/** Positions are the ones a reviewer reads: the first screen is 1. */
export type ScreenRow =
  | { position: number; screen: SnapshotScreen; status: "new" }
  | { screen: SnapshotScreen; status: "removed"; was: number }
  | { position: number; screen: SnapshotScreen; status: "unchanged" }
  | { position: number; screen: SnapshotScreen; status: "moved"; was: number }
  | {
      answerKey: boolean;
      baseChanged: boolean;
      before: SnapshotScreen;
      position: number;
      screen: SnapshotScreen;
      status: "changed";
      variants: VariantEdit[];
      /** Set when the screen also moved among the screens it kept. */
      was: number | null;
    };

export function ideaIndexOf(screen: SnapshotScreen): number | null {
  const { marks } = screen;
  return isJsonObject(marks) && typeof marks.ideaIndex === "number" ? marks.ideaIndex : null;
}

/** Which of the old ideas each final idea is, by the `from` its entry named; a new idea is null. */
export function ideaSources(change: StoredScreens): (number | null)[] {
  const ideas = change.proposal?.ideas;
  const count = ideaCount(change.after.summary);

  return Array.from({ length: count }, (_, index) =>
    ideas ? (ideas[index]?.from ?? null) : index,
  );
}

function ideaCount(summary: unknown): number {
  return isJsonObject(summary) && Array.isArray(summary.ideas) ? summary.ideas.length : 0;
}

function ideaTexts(value: unknown): unknown[] {
  return isJsonObject(value) && Array.isArray(value.ideas)
    ? value.ideas.map((idea) => (isJsonObject(idea) ? idea.text : idea))
    : [];
}

/** A summary screen shows the map's ideas, so a map change reaches it without the screen changing. */
function showsMap(screen: SnapshotScreen, snapshot: ScreenSnapshot): boolean {
  return (
    screen.kind === "summary" &&
    isDeepStrictEqual(ideaTexts(screen.content), ideaTexts(snapshot.summary))
  );
}

function sameScreen({
  after,
  before,
  change,
}: {
  after: SnapshotScreen;
  before: SnapshotScreen;
  change: StoredScreens;
}): boolean {
  return (
    before.kind === after.kind &&
    before.wordId === after.wordId &&
    before.sentenceId === after.sentenceId &&
    before.mediaAssetId === after.mediaAssetId &&
    (isDeepStrictEqual(before.content, after.content) ||
      (showsMap(before, change.before) && showsMap(after, change.after)))
  );
}

/**
 * Which old screen each final screen keeps. A proposal names it by id; an undo has no proposal, so
 * its screens are matched to the identical screens they put back.
 */
function pairScreens(change: StoredScreens): (number | null)[] {
  const { after, before, proposal } = change;

  if (proposal) {
    return proposal.screens.map((entry) =>
      "id" in entry && entry.id ? before.screens.findIndex(({ id }) => id === entry.id) : null,
    );
  }

  const used = new Set<number>();

  return after.screens.map((screen) => {
    const index = before.screens.findIndex(
      (candidate, at) => !used.has(at) && sameScreen({ after: screen, before: candidate, change }),
    );

    if (index === -1) {
      return null;
    }

    used.add(index);
    return index;
  });
}

/** The kept screens that stay in their old order; every other kept screen moved. */
function longestInOrder(indexes: readonly number[]): Set<number> {
  const tails: number[] = [];
  const previous = new Map<number, number | null>();

  for (const [at, value] of indexes.entries()) {
    let low = 0;
    let high = tails.length;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const tail = tails[middle] ?? 0;

      if ((indexes[tail] ?? 0) < value) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    previous.set(at, low > 0 ? (tails[low - 1] ?? null) : null);
    tails[low] = at;
  }

  const kept = new Set<number>();
  let at = tails.at(-1) ?? null;

  while (at !== null) {
    kept.add(indexes[at] ?? -1);
    at = previous.get(at) ?? null;
  }

  return kept;
}

function baseScreenChanged({
  after,
  before,
  change,
  sources,
}: {
  after: SnapshotScreen;
  before: SnapshotScreen;
  change: StoredScreens;
  sources: readonly (number | null)[];
}): boolean {
  const afterIdea = ideaIndexOf(after);

  return (
    !sameScreen({ after, before, change }) ||
    before.sourceId !== after.sourceId ||
    before.sourcePage !== after.sourcePage ||
    (afterIdea === null ? null : (sources[afterIdea] ?? null)) !== ideaIndexOf(before) ||
    Boolean(after.wordId && change.changedWordIds.includes(after.wordId)) ||
    Boolean(after.sentenceId && change.changedSentenceIds.includes(after.sentenceId))
  );
}

function editedVariants(before: SnapshotScreen, after: SnapshotScreen): VariantEdit[] {
  return after.variants.flatMap((variant) => {
    const previous = before.variants.find(
      ({ kind, key }) => kind === variant.kind && key === variant.key,
    );

    return previous && !isDeepStrictEqual(previous.content, variant.content)
      ? [{ after: variant, before: previous }]
      : [];
  });
}

function changesAnswerKey({
  before,
  after,
}: {
  before: Pick<SnapshotScreen, "content">;
  after: Pick<SnapshotScreen, "content">;
}): boolean {
  return listContentValueChanges({ after: after.content, before: before.content }).some(
    (value) => value.isAnswerKey,
  );
}

function keptRow({
  anchored,
  before,
  change,
  marked,
  position,
  screen,
  sources,
  was,
}: {
  anchored: boolean;
  before: SnapshotScreen;
  /** Whether the fix marks the screen's example box and underline again. */
  marked: boolean;
  change: StoredScreens;
  position: number;
  screen: SnapshotScreen;
  sources: readonly (number | null)[];
  was: number;
}): ScreenRow {
  const baseChanged = baseScreenChanged({ after: screen, before, change, sources });
  const variants = editedVariants(before, screen);

  if (baseChanged || variants.length > 0 || marked) {
    return {
      answerKey:
        changesAnswerKey({ after: screen, before }) ||
        variants.some((edit) => changesAnswerKey(edit)),
      baseChanged,
      before,
      position,
      screen,
      status: "changed",
      variants,
      was: anchored ? null : was,
    };
  }

  return anchored
    ? { position, screen, status: "unchanged" }
    : { position, screen, status: "moved", was };
}

/**
 * The lesson's screens in their final order, each with what the fix does to it. A removed screen
 * sits where it was among the screens that kept their order.
 */
export function readScreenRows(change: StoredScreens): ScreenRow[] {
  const pairs = pairScreens(change);
  const sources = ideaSources(change);
  const keptIndexes = pairs.filter((index): index is number => index !== null && index >= 0);
  const anchored = longestInOrder(keptIndexes);

  const removed = change.before.screens
    .map((screen, index) => ({ index, screen }))
    .filter(({ index }) => !keptIndexes.includes(index));

  const markedPositions = new Set(
    (change.mediaLinks ?? []).flatMap((link) => (link.target === "marks" ? link.positions : [])),
  );

  const rows: ScreenRow[] = [];
  let placed = 0;

  const placeRemoved = (upTo: number) => {
    for (const { index, screen } of removed.slice(placed)) {
      if (index >= upTo) {
        return;
      }

      rows.push({ screen, status: "removed", was: index + 1 });
      placed += 1;
    }
  };

  for (const [at, screen] of change.after.screens.entries()) {
    const index = pairs[at] ?? null;
    const before = index === null ? undefined : change.before.screens[index];

    if (index === null || !before) {
      rows.push({ position: at + 1, screen, status: "new" });
    } else {
      if (anchored.has(index)) {
        placeRemoved(index);
      }

      rows.push(
        keptRow({
          anchored: anchored.has(index),
          before,
          change,
          marked: markedPositions.has(screen.position),
          position: at + 1,
          screen,
          sources,
          was: index + 1,
        }),
      );
    }
  }

  placeRemoved(Number.POSITIVE_INFINITY);
  return rows;
}
