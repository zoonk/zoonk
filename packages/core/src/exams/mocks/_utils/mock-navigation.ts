import { isDeepStrictEqual } from "node:util";
import { type SectionNavigation } from "../../../library/exams/blueprint-contract";

/** A saved answer of the running section, as forward-only rules read it. */
type SectionRow = { answer: unknown; changes: number; itemId: string };

/** The furthest question of the section with a saved answer (or blank), -1 before the first. */
function getReached({
  itemIds,
  rows,
}: {
  itemIds: readonly string[];
  rows: readonly SectionRow[];
}): number {
  return Math.max(-1, ...rows.map((row) => itemIds.indexOf(row.itemId)));
}

function countChanges(rows: readonly SectionRow[]): number {
  return rows.reduce((sum, row) => sum + row.changes, 0);
}

/**
 * Whether a forward-only section takes an answer, as the real exam does: the question on screen
 * and the ones after it, freely; one already left behind keeps its answer (its time and flag
 * still save), except in the review at the section's end, which changes as many answers as the
 * notice allows (`changed`: this save uses one). An answer the review changed already may change
 * again for free, so a typed one counts once, not once per save.
 */
export function judgeForwardOnlySave({
  answer,
  itemId,
  itemIds,
  navigation,
  rows,
}: {
  answer: unknown;
  itemId: string;
  itemIds: readonly string[];
  navigation: SectionNavigation;
  rows: readonly SectionRow[];
}): { changed: boolean; status: "locked" | "saved" } {
  const reached = getReached({ itemIds, rows });

  if (itemIds.indexOf(itemId) >= reached) {
    return { changed: false, status: "saved" };
  }

  const row = rows.find((entry) => entry.itemId === itemId);

  if (isDeepStrictEqual(row?.answer ?? null, answer)) {
    return { changed: false, status: "saved" };
  }

  const inReview = reached === itemIds.length - 1;
  const allowed = navigation.answerChanges ?? 0;

  if (inReview && row && row.changes > 0) {
    return { changed: false, status: "saved" };
  }

  return inReview && countChanges(rows) < allowed
    ? { changed: true, status: "saved" }
    : { changed: false, status: "locked" };
}

/**
 * Where a section that moves freely opens again: where the learner stopped, at the furthest
 * question they got to or the one after their furthest answer, whichever is later.
 */
function getFreePlace({
  itemIds,
  rows,
}: {
  itemIds: readonly string[];
  rows: readonly SectionRow[];
}): number {
  const answered = getReached({ itemIds, rows: rows.filter((row) => row.answer !== null) });
  const next = Math.min(answered + 1, itemIds.length - 1);

  return Math.max(0, next, getReached({ itemIds, rows }));
}

/**
 * Where a section opens again after a reload, with no limit on changes where it moves freely. A
 * forward-only one opens at the furthest question the learner got to, since the ones before it
 * are behind them, with the answers its end review may still change.
 */
export function getSectionPlace({
  itemIds,
  navigation,
  rows,
}: {
  itemIds: readonly string[];
  navigation: SectionNavigation | null | undefined;
  rows: readonly SectionRow[];
}): { changesLeft: number | null; resume: number } {
  if (!navigation?.forwardOnly) {
    return { changesLeft: null, resume: getFreePlace({ itemIds, rows }) };
  }

  const changesLeft =
    navigation.answerChanges === null
      ? null
      : Math.max(0, navigation.answerChanges - countChanges(rows));

  return { changesLeft, resume: Math.max(0, getReached({ itemIds, rows })) };
}
