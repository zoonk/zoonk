import { coursePlanInputSchema } from "@zoonk/core/courses/learning-plan-contract";
import { z } from "zod";
import { chapterResourceSchema, lessonResourceSchema } from "./catalog-resources";

export const courseLearningTargetSchema = z.object({
  brandSlug: z.string(),
  chapterId: z.uuid(),
  chapterSlug: z.string(),
  courseId: z.uuid(),
  courseSlug: z.string(),
  generationStatus: z.enum(["pending", "running", "completed", "failed"]),
  lessonId: z.uuid().optional(),
  lessonSlug: z.string().optional(),
});

const courseLearningPlanSchema = coursePlanInputSchema.extend({
  chapterIds: z.array(z.uuid()),
  contentRevision: z.number().int().nonnegative(),
  courseId: z.uuid(),
  id: z.uuid(),
  revision: z.number().int().positive(),
  summary: z.string().nullable(),
});

export const updateLearningPlanBodySchema = z
  .object({
    expectedRevision: z.number().int().nonnegative().optional(),
    input: coursePlanInputSchema,
  })
  .strict();

export const startCourseBodySchema = updateLearningPlanBodySchema.partial();

const learningPathProgressSchema = z.object({
  completedChapters: z.number().int().nonnegative(),
  completedLessons: z.number().int().nonnegative(),
  totalChapters: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
});

const learningPathLessonSchema = lessonResourceSchema.extend({ isCompleted: z.boolean() });

const learningPathChapterSchema = chapterResourceSchema.extend({
  completedLessons: z.number().int().nonnegative(),
  isCompleted: z.boolean(),
  lessons: z.array(learningPathLessonSchema),
  totalLessons: z.number().int().nonnegative(),
});

export const courseLearningPathSchema = z.object({
  chapters: z.array(learningPathChapterSchema),
  needsCurriculumUpdate: z.boolean(),
  needsPlan: z.boolean(),
  nextTarget: courseLearningTargetSchema.nullable(),
  plan: courseLearningPlanSchema.nullable(),
  progress: learningPathProgressSchema,
  status: z.literal("ready"),
  supportsLearningPlan: z.boolean(),
});

export const coursePlanResponseSchema = z.object({ plan: courseLearningPlanSchema.nullable() });

export const startCourseResponseSchema = z.union([
  courseLearningPathSchema,
  z.object({
    contentRevision: z.number().int().positive(),
    courseId: z.uuid(),
    resource: z.literal("curriculum"),
    resourceId: z.uuid(),
    status: z.literal("generationRequired"),
  }),
]);
