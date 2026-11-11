import { type Task } from "@/lib/types";
import {
  type CheckLanguageLessonParams,
  checkLanguageLesson,
} from "@zoonk/ai/tasks/language/language-lesson-check";
import { listLanguageReviewScreens } from "@zoonk/core/library/language/review-screens";
import { scoreLessonQualityCheck } from "../lesson-quality-check/scorer";
import { type LessonQualityCheckExpected } from "../lesson-quality-check/test-cases";
import { type LanguageLessonCheckInput, TEST_CASES } from "./test-cases";

type ModelOptions = Pick<CheckLanguageLessonParams, "model" | "reasoning" | "useFallback">;

function reviewLesson({ lesson, writer, ...options }: LanguageLessonCheckInput & ModelOptions) {
  return checkLanguageLesson({
    ...writer,
    ...options,
    screens: listLanguageReviewScreens({
      content: lesson,
      learnerLanguage: writer.learnerLanguage,
      targetLanguage: writer.targetLanguage,
    }),
    writerModel: "openai/gpt-6.1-terra",
  });
}

export const languageLessonCheckTask: Task<
  LanguageLessonCheckInput,
  Awaited<ReturnType<typeof checkLanguageLesson>>["data"],
  LessonQualityCheckExpected
> = {
  description:
    "Review a published language lesson as a teacher of the language from another model family: find wrong forms, options also right for what the screen shows, wrong respellings, giveaways and typos, and pass clean lessons",
  generate: reviewLesson,
  id: "language-lesson-check",
  name: "Language Lesson Check",
  score: scoreLessonQualityCheck,
  testCases: TEST_CASES,
};
