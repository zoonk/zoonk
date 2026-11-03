import { type Task } from "@/lib/types";
import {
  type CheckLessonQualityParams,
  checkLessonQuality,
} from "@zoonk/ai/tasks/quality/lesson-check";
import { describeActivityTemplates } from "@zoonk/core/library/activities/writer-templates";
import { toAlphabetLessonCheck } from "@zoonk/core/library/language/alphabet-lesson-check";
import { checkWrittenLesson, toReviewedLesson } from "@zoonk/core/library/quality/code-checks";
import { type AlphabetCheckInput } from "./alphabet-lessons";
import { scoreLessonQualityCheck } from "./scorer";
import {
  type LessonQualityCheckExpected,
  type LessonQualityCheckInput,
  TEST_CASES,
} from "./test-cases";

type LessonQualityCheckOutput = Awaited<ReturnType<typeof checkLessonQuality>>["data"];

type ModelOptions = Pick<CheckLessonQualityParams, "model" | "reasoning" | "useFallback">;

const WRITER_MODEL = "openai/gpt-6-sol";
const ALPHABET_WRITER_MODEL = "openai/gpt-6-luna";

function reviewAlphabetLesson({
  alphabet,
  learnerLanguage,
  targetLanguage,
  ...options
}: AlphabetCheckInput & ModelOptions) {
  return checkLessonQuality({
    ...toAlphabetLessonCheck({ learnerLanguage, lesson: alphabet, targetLanguage }),
    ...options,
    reuse: "bounded",
    writerModel: ALPHABET_WRITER_MODEL,
  });
}

function reviewWrittenLesson({
  lesson,
  model,
  reasoning,
  useFallback,
  ...context
}: LessonQualityCheckInput & ModelOptions) {
  const { screens } = checkWrittenLesson({
    exams: context.exams,
    language: context.language,
    lesson,
    level: context.level,
    shortAnswers: context.shortAnswers,
    spec: context.spec,
  });

  return checkLessonQuality({
    ...context,
    activityTemplates: describeActivityTemplates(
      context.spec.screens.flatMap((screen) => screen.activityTemplate ?? []),
    ),
    lesson: toReviewedLesson({ lesson, screens }),
    model,
    reasoning,
    reuse: "bounded",
    useFallback,
    writerModel: WRITER_MODEL,
  });
}

function reviewLesson(input: (AlphabetCheckInput | LessonQualityCheckInput) & ModelOptions) {
  return "alphabet" in input ? reviewAlphabetLesson(input) : reviewWrittenLesson(input);
}

export const lessonQualityCheckTask: Task<
  AlphabetCheckInput | LessonQualityCheckInput,
  LessonQualityCheckOutput,
  LessonQualityCheckExpected
> = {
  description:
    "Review a written or alphabet lesson as an expert from another model family: block wrong facts and sound cues, wrong answer keys, jargon before it's explained, filler, level misfits and decorative activities, and pass clean lessons",
  generate: reviewLesson,
  id: "lesson-quality-check",
  name: "Lesson Quality Check",
  score: scoreLessonQualityCheck,
  testCases: TEST_CASES,
};
