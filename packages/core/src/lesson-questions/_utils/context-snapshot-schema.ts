import "server-only";
import { type LessonQuestionContextSnapshot } from "@zoonk/ai/tasks/lessons/question";
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

const lessonQuestionContextSnapshotSchema = z.object({
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

const databaseContextSnapshotSchema = z.record(z.string(), z.json());

export function parseLessonQuestionContextSnapshot(value: unknown): LessonQuestionContextSnapshot {
  return lessonQuestionContextSnapshotSchema.parse(value);
}

export function toDatabaseLessonQuestionContextSnapshot(snapshot: LessonQuestionContextSnapshot) {
  return databaseContextSnapshotSchema.parse(snapshot);
}
