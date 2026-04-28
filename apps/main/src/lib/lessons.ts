import { type LessonKind } from "@zoonk/db";
import { getExtracted } from "next-intl/server";

export async function getLessonKinds(): Promise<{ key: LessonKind; label: string }[]> {
  const t = await getExtracted();

  return [
    { key: "alphabet", label: t("Alphabet") },
    { key: "tutorial", label: t("Tutorial") },
    { key: "explanation", label: t("Explanation") },
    { key: "quiz", label: t("Quiz") },
    { key: "practice", label: t("Practice") },
    { key: "vocabulary", label: t("Vocabulary") },
    { key: "translation", label: t("Translation") },
    { key: "grammar", label: t("Grammar") },
    { key: "reading", label: t("Reading") },
    { key: "listening", label: t("Listening") },
    { key: "review", label: t("Review") },
  ];
}

async function getSeoDescription(kind: LessonKind, topic: string): Promise<string> {
  const t = await getExtracted();

  const descriptions: Record<LessonKind, string> = {
    alphabet: t("Learn the writing system for {topic} with focused practice.", { topic }),
    custom: t("Learn about {topic} through an interactive lesson.", { topic }),
    explanation: t(
      "Understand what {topic} is — core concepts and definitions explained with clear metaphors and analogies.",
      { topic },
    ),
    grammar: t(
      "Practice {topic} grammar rules with exercises designed to help you remember and apply them.",
      { topic },
    ),
    listening: t("Sharpen your {topic} listening skills by translating audio sentences.", {
      topic,
    }),
    practice: t("Apply {topic} through a visual real-world problem with short decisions.", {
      topic,
    }),
    quiz: t(
      "Test your understanding of {topic} with questions designed to check real comprehension, not just memorization.",
      { topic },
    ),
    reading: t(
      "Improve your {topic} reading comprehension by translating sentences and passages.",
      { topic },
    ),
    review: t("Review everything you learned about {topic} with a comprehensive quiz.", { topic }),
    translation: t("Test your {topic} vocabulary by translating words you've learned.", { topic }),
    tutorial: t("Learn {topic} with a guided step-by-step tutorial.", { topic }),
    vocabulary: t(
      "Learn new {topic} words with flashcards — see each word, its translation, and pronunciation.",
      { topic },
    ),
  };

  return descriptions[kind];
}

export async function getLessonSeoMeta(
  lesson: { kind: LessonKind; title: string | null; description: string | null },
  lessonTitle: string,
): Promise<{ title: string; description: string }> {
  const [title, description] = await Promise.all([
    getSeoTitle(lesson, lessonTitle),
    getSeoLessonDescription(lesson, lessonTitle),
  ]);

  return { description, title };
}

async function getSeoTitle(
  lesson: { kind: LessonKind; title: string | null },
  lessonTitle: string,
): Promise<string> {
  const t = await getExtracted();

  if (lesson.title) {
    return t("{lesson} - {course}", { course: lessonTitle, lesson: lesson.title });
  }

  const kinds = await getLessonKinds();
  const kindInfo = kinds.find((kind) => kind.key === lesson.kind);

  if (kindInfo) {
    return t("{kind} {lesson}", { kind: kindInfo.label, lesson: lessonTitle });
  }

  return lessonTitle;
}

async function getSeoLessonDescription(
  lesson: { kind: LessonKind; description: string | null },
  lessonTitle: string,
): Promise<string> {
  if (lesson.kind === "custom" && lesson.description) {
    return lesson.description;
  }

  return getSeoDescription(lesson.kind, lessonTitle);
}
