import {
  type PublishedAlphabetLesson,
  listAlphabetScreens,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { type CheckLessonQualityParams } from "@zoonk/ai/tasks/quality/lesson-check";
import { getLanguageName } from "@zoonk/utils/languages";

export const ALPHABET_LESSON_MINUTES = 5;

type AlphabetLessonCheck = Pick<
  CheckLessonQualityParams,
  | "activityTemplates"
  | "alphabet"
  | "chapterTitle"
  | "courseTitle"
  | "language"
  | "lesson"
  | "level"
  | "spec"
>;

/**
 * An alphabet lesson is written without a lesson plan, so the reviewer reads it as the first
 * beginner lesson of the language's course, with its letters as the screens.
 */
export function toAlphabetLessonCheck({
  learnerLanguage,
  lesson,
  targetLanguage,
}: {
  learnerLanguage: string;
  lesson: PublishedAlphabetLesson;
  targetLanguage: string;
}): AlphabetLessonCheck {
  return {
    activityTemplates: [],
    alphabet: true,
    chapterTitle: lesson.title,
    courseTitle: getLanguageName({ targetLanguage, userLanguage: "en" }),
    language: learnerLanguage,
    lesson: {
      screens: listAlphabetScreens(lesson),
      summary: { ideas: lesson.summary.map((text) => ({ text })), shape: "hub" },
    },
    level: "beginner",
    spec: {
      canDo: lesson.canDo,
      description: lesson.description,
      estimatedMinutes: ALPHABET_LESSON_MINUTES,
      screens: [],
      skills: [],
      supportMode: "explanationFirst",
      title: lesson.title,
    },
  };
}
