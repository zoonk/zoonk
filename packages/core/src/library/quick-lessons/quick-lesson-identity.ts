import { scopeIdentityKey } from "@zoonk/utils/identity-key";

/** What a quick lesson takes until its spec says: a few short screens and one worked example. */
export const QUICK_LESSON_MINUTES = 4;

const QUICK_KEY = "quick:";

/** A quick lesson's identity is its skill's (`quick:<skillId>`, owner-scoped when private). */
const QUICK_IDENTITY_PATTERN = /(?:^|:)quick:[\da-f-]{36}$/u;

export function getQuickLessonIdentityKey({
  ownerId,
  skillId,
}: {
  ownerId: string | null;
  skillId: string;
}): string {
  return scopeIdentityKey({ key: `${QUICK_KEY}${skillId}`, ownerId });
}

/**
 * Whether a lesson is a skill's quick lesson, from its identity key alone, so the lesson pipeline
 * plans it as one without reading anything else.
 */
export function isQuickLessonIdentityKey(identityKey: string): boolean {
  return QUICK_IDENTITY_PATTERN.test(identityKey);
}

/**
 * Quick lessons by identity key, shared or owner-scoped, for queries that must leave them out: a
 * quick lesson is never one of its skill's lessons, which plans and identity search pick from.
 */
export const QUICK_LESSON_KEY_WHERE = {
  OR: [{ identityKey: { startsWith: QUICK_KEY } }, { identityKey: { contains: `:${QUICK_KEY}` } }],
};

/** The same rule in SQL, for the identity search's raw queries over `library_lessons l`. */
export const QUICK_LESSON_KEY_SQL_PATTERN = `(^|:)${QUICK_KEY}`;

/**
 * The chapter whose other lessons a lesson is planned and written next to, so it adds something
 * new: its home chapter, or none for a quick lesson, which sums its skill up on its own (the
 * skill's lessons there teach what it summarizes).
 */
export function getSiblingsChapterId(lesson: {
  homeChapterId: string | null;
  identityKey: string;
}): string | null {
  return isQuickLessonIdentityKey(lesson.identityKey) ? null : lesson.homeChapterId;
}
