import { type LessonKind } from "@zoonk/db";
import { getExtracted } from "next-intl/server";

type LessonDisplayInput = { kind: LessonKind; title: string | null; description: string | null };

type LessonSeoInput = LessonDisplayInput & {
  chapter: { title: string; course: { title: string } };
  position: number;
};

/**
 * Lesson kind labels are used in several app-level fallbacks. Keeping them in
 * one translated map prevents the chapter list, player metadata, and SEO copy
 * from drifting when a label changes.
 */
export async function getLessonKindLabels(): Promise<Record<LessonKind, string>> {
  const t = await getExtracted();

  return {
    alphabet: t("Alphabet"),
    custom: t("Custom lesson"),
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
}

/**
 * System-created lessons such as practice, quiz, reading, and review do not
 * store generated titles or descriptions. The app renders those labels from
 * current translations so copy can change without regenerating curriculum rows.
 */
export async function getLessonDisplayMeta(
  lesson: LessonDisplayInput,
): Promise<{ description: string; title: string }> {
  const labels = await getLessonKindLabels();
  const t = await getExtracted();

  function getTitle(): string {
    if (lesson.title) {
      return lesson.title;
    }

    return labels[lesson.kind];
  }

  function getDescription(): string {
    if (lesson.description) {
      return lesson.description;
    }

    const descriptions: Record<LessonKind, string> = {
      alphabet: t("Learn the alphabet and writing system with focused practice."),
      custom: t("Work through a guided lesson."),
      explanation: t("Understand the key ideas before applying them."),
      grammar: t("Practice grammar patterns with examples and exercises."),
      listening: t("Listen to sentences built from the latest vocabulary."),
      practice: t("Apply the previous explanations in a guided problem."),
      quiz: t("Check your understanding with a short quiz."),
      reading: t("Read sentences built from the latest vocabulary."),
      review: t("Review this chapter with practice based on your mistakes."),
      translation: t("Translate the words from the previous vocabulary lesson."),
      tutorial: t("Follow a guided step-by-step tutorial."),
      vocabulary: t("Learn new words with focused vocabulary practice."),
    };

    return descriptions[lesson.kind];
  }

  return { description: getDescription(), title: getTitle() };
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
  lesson: LessonSeoInput,
): Promise<{ title: string; description: string }> {
  const title = await getSeoTitle({ lesson });

  const description = await getSeoLessonDescription({
    lesson,
    lessonTitle: lesson.title ?? lesson.chapter.title,
  });

  return { description, title };
}

/**
 * Generated companion lessons often store no title because their title would be
 * only the lesson kind. SEO needs enough context to distinguish several quizzes
 * or practices in the same chapter, so the fallback names the chapter, kind, and
 * human lesson number instead of repeating the kind label.
 */
async function getUntitledLessonSeoTitle({
  chapterTitle,
  kind,
  position,
}: {
  chapterTitle: string;
  kind: LessonKind;
  position: number;
}) {
  const labels = await getLessonKindLabels();
  const t = await getExtracted();

  return t("{chapter} {kind} {position}", {
    chapter: chapterTitle,
    kind: labels[kind],
    position: String(position + 1),
  });
}

async function getSeoTitle({ lesson }: { lesson: LessonSeoInput }): Promise<string> {
  if (lesson.title) {
    const t = await getExtracted();

    return t("{lesson} - {course}", { course: lesson.chapter.course.title, lesson: lesson.title });
  }

  return getUntitledLessonSeoTitle({
    chapterTitle: lesson.chapter.title,
    kind: lesson.kind,
    position: lesson.position,
  });
}

async function getSeoLessonDescription({
  lesson,
  lessonTitle,
}: {
  lesson: { kind: LessonKind; description: string | null };
  lessonTitle: string;
}): Promise<string> {
  if (lesson.kind === "custom" && lesson.description) {
    return lesson.description;
  }

  return getSeoDescription(lesson.kind, lessonTitle);
}
