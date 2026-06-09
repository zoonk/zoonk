import { type LessonKind, type Sql, sql } from "@zoonk/db";

export type LessonKindExclusion = { excludedLessonKinds?: LessonKind[] };

/**
 * React cache keys compare array arguments by identity, so hidden-kind filters
 * need to become sorted primitive arguments before they reach cached loaders.
 * Dedupe keeps logically identical filters such as ["quiz", "quiz"] and
 * ["quiz"] sharing the same cache entry.
 */
export function getLessonKindExclusionCacheArgs({
  excludedLessonKinds,
}: LessonKindExclusion): LessonKind[] {
  return [...new Set(excludedLessonKinds)].toSorted();
}

/**
 * Converts user-hidden lesson kinds into the Prisma fragment shared by lesson
 * navigation queries. Returning an empty object when nothing is hidden keeps
 * callers from adding separate branches around every published-lesson filter.
 */
export function getLessonKindExclusionWhere({ excludedLessonKinds }: LessonKindExclusion): {
  kind?: { notIn: LessonKind[] };
} {
  if (!excludedLessonKinds?.length) {
    return {};
  }

  return { kind: { notIn: excludedLessonKinds } };
}

/**
 * Raw progress-style SQL uses the `lessons` table as alias `l`, so callers can
 * reuse this predicate whenever they need the same hidden-kind exclusion
 * outside Prisma's object query API.
 */
export function getLessonKindExclusionSql({ excludedLessonKinds }: LessonKindExclusion): Sql {
  if (!excludedLessonKinds?.length) {
    return sql`TRUE`;
  }

  return getLessonKindExclusionSqlParts(excludedLessonKinds);
}

/**
 * Recursively composes one parameter per hidden lesson kind so raw SQL stays
 * injection-safe without hand-building an `IN (...)` string.
 */
function getLessonKindExclusionSqlParts([kind, ...rest]: LessonKind[]): Sql {
  if (!kind) {
    return sql`TRUE`;
  }

  return sql`l.kind <> ${kind}::"LessonKind" AND ${getLessonKindExclusionSqlParts(rest)}`;
}
