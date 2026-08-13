import { isSplitLessonSlug } from "@zoonk/core/lessons/split-lessons";
import { type LessonKind } from "@zoonk/db";

export const INDEXABLE_CHAPTER_LESSON_KIND = "review" as const satisfies LessonKind;

export const INDEXABLE_AUTHORED_LESSON_KINDS = [
  "alphabet",
  "custom",
  "explanation",
  "grammar",
  "tutorial",
  "vocabulary",
] as const satisfies readonly LessonKind[];

export const INDEXABLE_EXPLANATION_COMPANION_LESSON_KINDS = [
  "practice",
  "quiz",
] as const satisfies readonly LessonKind[];

const INDEXABLE_COMPANION_LESSON_KINDS = [
  ...INDEXABLE_EXPLANATION_COMPANION_LESSON_KINDS,
  "translation",
] as const satisfies readonly LessonKind[];

const INDEXABLE_AUTHORED_LESSON_KIND_SET = new Set<LessonKind>(INDEXABLE_AUTHORED_LESSON_KINDS);

const INDEXABLE_COMPANION_LESSON_KIND_SET = new Set<LessonKind>(INDEXABLE_COMPANION_LESSON_KINDS);

/**
 * Companion lesson metadata should name the authored topic that actually
 * produced its content. Quiz and practice rows follow an explanation, while a
 * translation row follows the vocabulary lesson whose words it reuses.
 */
export function getLessonSeoSourceKind(kind: LessonKind): LessonKind | null {
  if (kind === "practice" || kind === "quiz") {
    return "explanation";
  }

  if (kind === "translation") {
    return "vocabulary";
  }

  return null;
}

/**
 * Authored lessons need their own title and description, while single-source
 * companions need the source title that makes their metadata specific. A
 * chapter has one review lesson, so its chapter title provides a unique topic.
 * Reading and listening can combine several vocabulary lessons, so those kinds
 * remain out of the index until they have an accurate standalone topic. Split
 * continuations stay out because their numbered metadata repeats the root topic.
 */
export function isLessonSeoIndexable({
  description,
  kind,
  slug,
  sourceTitle,
  title,
}: {
  description: string | null;
  kind: LessonKind;
  slug: string;
  sourceTitle: string | null;
  title: string | null;
}): boolean {
  if (isSplitLessonSlug(slug)) {
    return false;
  }

  if (kind === INDEXABLE_CHAPTER_LESSON_KIND) {
    return true;
  }

  if (INDEXABLE_COMPANION_LESSON_KIND_SET.has(kind)) {
    return Boolean(sourceTitle?.trim());
  }

  return (
    INDEXABLE_AUTHORED_LESSON_KIND_SET.has(kind) &&
    Boolean(title?.trim()) &&
    Boolean(description?.trim())
  );
}
