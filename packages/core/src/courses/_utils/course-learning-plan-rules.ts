import { type Chapter, type CourseLearningPlan, type Lesson } from "@zoonk/db";
import {
  CORE_COURSE_LEVELS,
  type CoursePlanInput,
  LANGUAGE_COURSE_LEVELS,
  OPTIONAL_LESSON_KINDS,
} from "../learning-plan-contract";

export function planPreferences(plan: CourseLearningPlan): CoursePlanInput {
  return {
    dailyMinutes: plan.dailyMinutes,
    depth: plan.depth,
    goal: plan.goal,
    hiddenLessonKinds: plan.hiddenLessonKinds,
    startingKnowledge: plan.startingKnowledge,
    startingLevel: plan.startingLevel,
  };
}

export function defaultChapterIds({
  chapters,
  format,
  preferences,
}: {
  chapters: Chapter[];
  format: string;
  preferences: CoursePlanInput;
}) {
  if (format === "question" || format === "personalized") {
    return chapters.map((chapter) => chapter.id);
  }

  if (preferences.depth === "overview" && format !== "language") {
    return chapters.filter((chapter) => chapter.level === "overview").map((chapter) => chapter.id);
  }

  const levels: readonly string[] =
    format === "language" ? LANGUAGE_COURSE_LEVELS : CORE_COURSE_LEVELS.slice(1);

  const start = preferences.startingLevel ? levels.indexOf(preferences.startingLevel) : 0;

  return chapters
    .filter(
      (chapter) => chapter.level === null || levels.indexOf(chapter.level) >= Math.max(start, 0),
    )
    .map((chapter) => chapter.id);
}

export function requiredLessons({
  lessons,
  format: _format,
  preferences,
}: {
  lessons: Lesson[];
  format: string;
  preferences: CoursePlanInput;
}) {
  const excluded = new Set<string>([
    ...(preferences.hiddenLessonKinds ?? []),
    ...OPTIONAL_LESSON_KINDS,
  ]);

  return lessons.filter((lesson) => !lesson.sourceLessonId && !excluded.has(lesson.kind));
}

export function getInputError(format: string, input: CoursePlanInput) {
  const levels: readonly string[] =
    format === "language" ? LANGUAGE_COURSE_LEVELS : CORE_COURSE_LEVELS;

  if (input.startingLevel && !levels.includes(input.startingLevel)) {
    return "level";
  }

  if (format === "language" && input.depth === "overview") {
    return "depth";
  }

  if (input.depth === "focused" && !input.goal?.trim()) {
    return "goal";
  }

  const requiredKinds =
    format === "language"
      ? ["alphabet", "grammar", "vocabulary", "reading", "listening", "translation"]
      : ["explanation", "tutorial", "custom"];

  if (requiredKinds.every((kind) => input.hiddenLessonKinds?.some((hidden) => hidden === kind))) {
    return "lessonKinds";
  }

  return null;
}

export function hasEmptyTeachingSelection({
  chapters,
  format,
  preferences,
}: {
  chapters: (Chapter & { lessons: Lesson[] })[];
  format: string;
  preferences: CoursePlanInput;
}) {
  const authored = chapters.flatMap((chapter) =>
    chapter.lessons.filter(
      (lesson) =>
        !lesson.sourceLessonId && !OPTIONAL_LESSON_KINDS.some((kind) => kind === lesson.kind),
    ),
  );

  return (
    authored.length > 0 && requiredLessons({ format, lessons: authored, preferences }).length === 0
  );
}
