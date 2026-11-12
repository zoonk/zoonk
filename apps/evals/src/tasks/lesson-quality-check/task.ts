import { type Task } from "@/lib/types";
import {
  type CheckLessonQualityParams,
  checkLessonQuality,
} from "@zoonk/ai/tasks/quality/lesson-check";
import { describeActivityTemplates } from "@zoonk/core/library/activities/writer-templates";
import { toAlphabetLessonCheck } from "@zoonk/core/library/language/alphabet-lesson-check";
import { checkWrittenLesson, toReviewedLesson } from "@zoonk/core/library/quality/code-checks";
import { type AlphabetCheckInput } from "./alphabet-lessons";
import { REAL_REVIEW_CASES, type RealReviewInput } from "./real-cases";
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
    country: null,
    ...options,
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
    country: context.country ?? null,
    lesson: toReviewedLesson({ lesson, screens }),
    model,
    reasoning,
    useFallback,
    writerModel: WRITER_MODEL,
  });
}

function reviewLesson(
  input: (AlphabetCheckInput | LessonQualityCheckInput | RealReviewInput) & ModelOptions,
) {
  if ("recorded" in input) {
    const { recorded, ...options } = input;

    return checkLessonQuality({
      ...recorded.context,
      country: recorded.context.country ?? null,
      lesson: recorded.lesson,
      ...options,
      writerModel: "anthropic/claude-opus-5.5",
    });
  }

  return "alphabet" in input ? reviewAlphabetLesson(input) : reviewWrittenLesson(input);
}

export const lessonQualityCheckTask: Task<
  AlphabetCheckInput | LessonQualityCheckInput | RealReviewInput,
  LessonQualityCheckOutput,
  LessonQualityCheckExpected
> = {
  description:
    "Review a written or alphabet lesson as an expert from another model family: find factual errors, wrong answer keys and contradictions, and pass lessons with style flaws",
  generate: reviewLesson,
  id: "lesson-quality-check",
  name: "Lesson Quality Check",
  score: scoreLessonQualityCheck,
  testCases: [...TEST_CASES, ...REAL_REVIEW_CASES],
};
