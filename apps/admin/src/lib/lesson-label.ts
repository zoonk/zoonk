import { type LessonKind } from "@zoonk/db";

type LessonLabelInput = { kind: LessonKind; title: string | null };

/**
 * Admin review queues can receive structural lessons that intentionally have
 * no stored title. The fallback mirrors the learner-facing kind label closely
 * enough for reviewers to understand what generated item they are checking.
 */
export function getAdminLessonLabel({ kind, title }: LessonLabelInput): string {
  if (title) {
    return title;
  }

  const labels: Record<LessonKind, string> = {
    alphabet: "Alphabet",
    custom: "Custom lesson",
    explanation: "Explanation",
    grammar: "Grammar",
    listening: "Listening",
    practice: "Practice",
    quiz: "Quiz",
    reading: "Reading",
    review: "Review",
    translation: "Translation",
    tutorial: "Tutorial",
    vocabulary: "Vocabulary",
  };

  return labels[kind];
}
