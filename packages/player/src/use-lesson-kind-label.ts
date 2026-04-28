import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";

/**
 * Map an lesson kind to a human-readable label. Used as fallback when
 * the lesson has no custom title, matching how the lesson list displays
 * lesson kinds throughout the app.
 */
export function useLessonKindLabel(kind: LessonKind): string {
  const t = useExtracted();

  const labels: Record<LessonKind, string> = {
    alphabet: t("Alphabet"),
    custom: t("Lesson"),
    explanation: t("Explanation"),
    grammar: t("Grammar"),
    listening: t("Listening"),
    practice: t("Practice"),
    quiz: t("Quiz"),
    reading: t("Reading"),
    review: t("Review"),
    translation: t("Translation"),
    tutorial: t("Tutorial"),
    vocabulary: t("Vocabulary"),
  };

  return labels[kind];
}
