import { scopeIdentityKey } from "@zoonk/utils/identity-key";

export const QUICK_LESSON_MINUTES = 4;

const QUICK_KEY = "quick:";

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

export function isQuickLessonIdentityKey(identityKey: string): boolean {
  return QUICK_IDENTITY_PATTERN.test(identityKey);
}

export const QUICK_LESSON_KEY_WHERE = {
  OR: [{ identityKey: { startsWith: QUICK_KEY } }, { identityKey: { contains: `:${QUICK_KEY}` } }],
};

export const QUICK_LESSON_KEY_SQL_PATTERN = `(^|:)${QUICK_KEY}`;

export function getSiblingsChapterId(lesson: {
  homeChapterId: string | null;
  identityKey: string;
}): string | null {
  return isQuickLessonIdentityKey(lesson.identityKey) ? null : lesson.homeChapterId;
}
