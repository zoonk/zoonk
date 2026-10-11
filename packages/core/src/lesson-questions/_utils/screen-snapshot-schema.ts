import "server-only";
import { z } from "zod";

const lessonQuestionStepContextSchema = z.object({
  content: z.unknown(),
  kind: z.string(),
  sentence: z
    .object({
      explanation: z.string().nullable(),
      romanization: z.string().nullable(),
      sentence: z.string(),
      translation: z.string(),
    })
    .nullable(),
  stepNumber: z.number().int().min(1),
  word: z
    .object({
      pronunciation: z.string().nullable(),
      romanization: z.string().nullable(),
      translation: z.string(),
      word: z.string(),
    })
    .nullable(),
});

const lessonScopeSnapshotSchema = z.object({
  answer: z
    .object({
      correctAnswer: z.string().nullable(),
      feedback: z.string().nullable(),
      isCorrect: z.boolean(),
      selectedAnswer: z.string(),
    })
    .nullable()
    .default(null),
  chapter: z.object({ description: z.string().nullable(), title: z.string() }),
  course: z.object({
    description: z.string().nullable(),
    language: z.string(),
    targetLanguage: z.string().nullable(),
    title: z.string(),
  }),
  lesson: z.object({
    description: z.string().nullable(),
    kind: z.string(),
    language: z.string(),
    title: z.string().nullable(),
  }),
  lessonSteps: z.array(lessonQuestionStepContextSchema),
  scope: z.object({ kind: z.enum(["answer", "lesson", "step"]) }),
  step: lessonQuestionStepContextSchema.nullable(),
  version: z.literal(1),
});

const chapterScopeSnapshotSchema = z.object({
  chapter: z.object({
    description: z.string(),
    level: z.string(),
    objectives: z.array(z.string()),
    title: z.string(),
  }),
  course: z.object({ title: z.string() }).nullable(),
  language: z.string(),
  lessons: z.array(
    z.object({
      canDo: z.string().nullable(),
      description: z.string(),
      finished: z.boolean(),
      title: z.string(),
    }),
  ),
  scope: z.object({ kind: z.literal("chapter") }),
  version: z.literal(1),
});

const rangeSchema = z.object({ high: z.number(), low: z.number() }).nullable();

const mockScopeSnapshotSchema = z.object({
  areas: z.array(
    z.object({
      correct: z.number(),
      estimate: rangeSchema,
      name: z.string(),
      secondsPerQuestion: z.number(),
      targetSecondsPerQuestion: z.number().nullable(),
      total: z.number(),
    }),
  ),
  exam: z.object({
    date: z.string(),
    fullLength: z.boolean(),
    name: z.string().nullable(),
    number: z.number(),
    scoring: z.string(),
    scoringNote: z.string().nullable(),
  }),
  language: z.string(),
  missed: z.array(
    z.object({
      area: z.string().nullable(),
      correctAnswer: z.string().nullable(),
      explanation: z.string().nullable(),
      learnerAnswer: z.string().nullable(),
      number: z.number(),
      outcome: z.enum(["blank", "wrong"]),
      question: z.string(),
      skill: z.string().nullable(),
    }),
  ),
  mistakeCauses: z.array(z.object({ cause: z.string().nullable(), count: z.number() })),
  result: z
    .object({
      blank: z.number(),
      correct: z.number(),
      estimate: rangeSchema,
      minutesUsed: z.number(),
      plannedMinutes: z.number(),
      total: z.number(),
    })
    .nullable(),
  scope: z.object({ kind: z.literal("mock") }),
  sections: z.array(z.object({ name: z.string().nullable(), questions: z.number() })),
  version: z.literal(1),
});

/**
 * The page a question came from: a lesson (all of it, one screen or an answer given there), a
 * chapter or a finished mock, alone or with the goal's plan for the buddy.
 */
export const screenSnapshotSchema = z.union([
  lessonScopeSnapshotSchema,
  chapterScopeSnapshotSchema,
  mockScopeSnapshotSchema,
]);
