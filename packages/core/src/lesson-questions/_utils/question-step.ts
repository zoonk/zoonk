import { type StepGetPayload } from "@zoonk/db";

export const lessonQuestionStepInclude = {
  chapterSentence: true,
  chapterWord: true,
  sentence: true,
  word: { include: { pronunciations: true } },
} as const;

export type LessonQuestionStep = StepGetPayload<{ include: typeof lessonQuestionStepInclude }>;
