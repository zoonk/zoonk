import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type Json } from "./_utils/resolved-change";

/** A learner may be shown content fetched up to this long before their run or test started. */
const FETCHED_BEFORE_START_MS = 300_000;

/**
 * Part of a stored change, such as `{ model: "Step", id }`. A change matches when it holds every
 * key with the same value, and every entry of an array value.
 */
export type FixedRow = { [key: string]: Json; id: string; model: string };

function contains(value: unknown, part: unknown): boolean {
  if (Array.isArray(part)) {
    return (
      Array.isArray(value) && part.every((entry) => value.some((item) => contains(item, entry)))
    );
  }

  if (isJsonObject(part)) {
    return (
      isJsonObject(value) &&
      Object.entries(part).every(([key, entry]) => contains(value[key], entry))
    );
  }

  return value === part;
}

/**
 * Which of `rows` an applied content fix changed after a learner started (`startedAt`, less the
 * time they may hold content fetched before it). A fix never costs a learner who started before
 * it, so a not-right answer on such a row is excused instead of counted.
 */
export async function findRowsFixedSince({
  rows,
  startedAt,
}: {
  rows: readonly FixedRow[];
  startedAt: Date;
}): Promise<FixedRow[]> {
  if (rows.length === 0) {
    return [];
  }

  const fixes = await prisma.contentFix.findMany({
    select: { changes: true },
    where: {
      OR: rows.map((row) => ({ changes: { array_contains: [row] } })),
      decidedAt: { gte: new Date(startedAt.getTime() - FETCHED_BEFORE_START_MS) },
      status: "applied",
    },
  });

  return rows.filter((row) => fixes.some((fix) => contains(fix.changes, [row])));
}
