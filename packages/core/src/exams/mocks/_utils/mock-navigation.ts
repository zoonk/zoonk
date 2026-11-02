import { isDeepStrictEqual } from "node:util";
import { type SectionNavigation } from "../../../library/exams/blueprint-contract";

type SectionRow = { answer: unknown; changes: number; itemId: string };

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
