import {
  discoveryAnswersSchema,
  discoveryBriefSchema,
  discoveryQuestionSchema,
} from "@zoonk/core/courses/discovery-contract";
import { z } from "zod";
import { lessonResourceSchema } from "./catalog-resources";
import { courseFormatSchema, generationStatusSchema } from "./curriculum";
import { courseLearningPathSchema } from "./learning-plan";

export {
  discoveryAnswerInputSchema,
  discoveryRevisionInputSchema,
  learningRequestInputSchema,
} from "@zoonk/core/courses/discovery-contract";

export const discoveryPathParamsSchema = z.object({ discoveryId: z.uuid() });
export const startDiscoveryBodySchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();
export const emptyDiscoveryBodySchema = z.object({}).strict();
export const optionalActivityBodySchema = z.object({ kind: z.enum(["quiz", "practice"]) }).strict();
const generationRequirementSchema = z.object({
  resource: z.enum(["coursePrompt", "curriculum", "lesson"]),
  resourceId: z.uuid(),
});

const discoveryResourceSchema = z.object({
  answers: discoveryAnswersSchema,
  brief: discoveryBriefSchema.nullable(),
  courseId: z.uuid().nullable(),
  generationTarget: generationRequirementSchema.nullable(),
  id: z.uuid(),
  language: z.string(),
  prompt: z.string(),
  question: discoveryQuestionSchema.nullable(),
  revision: z.number().int().positive(),
  status: z.enum(["pending", "ask", "ready", "generating", "completed", "blocked", "failed"]),
});
export const discoveryResponseSchema = z.object({
  discovery: discoveryResourceSchema,
  status: z.literal("ready"),
});
export const discoveryStartResponseSchema = z.union([
  courseLearningPathSchema,
  generationRequirementSchema.extend({
    contentRevision: z.number().int().positive().optional(),
    courseId: z.uuid().optional(),
    discoveryId: z.uuid().optional(),
    status: z.literal("generationRequired"),
  }),
  z.object({ status: z.enum(["unsafe", "exam"]) }),
]);
export const learningRequestResponseSchema = z.discriminatedUnion("kind", [
  z.object({ courseId: z.uuid(), kind: z.literal("course") }),
  z.object({ coursePromptId: z.uuid(), kind: z.literal("generation") }),
  z.object({ discoveryId: z.uuid(), kind: z.literal("discovery") }),
  z.object({ kind: z.literal("track"), trackId: z.uuid() }),
  z.object({ kind: z.literal("unsafe") }),
  z.object({ kind: z.literal("exam") }),
]);
export const optionalActivitiesResponseSchema = z.object({
  activities: z.array(
    z.object({ kind: z.enum(["quiz", "practice"]), lesson: lessonResourceSchema.nullable() }),
  ),
  source: z.object({
    brandSlug: z.string(),
    chapterId: z.uuid(),
    chapterSlug: z.string(),
    courseId: z.uuid(),
    courseSlug: z.string(),
    lessonId: z.uuid(),
  }),
  status: z.literal("ready"),
});
export const optionalActivityStartResponseSchema = z.union([
  z.object({ lesson: lessonResourceSchema, status: z.literal("ready") }),
  generationRequirementSchema.extend({
    lesson: lessonResourceSchema,
    status: z.literal("generationRequired"),
  }),
]);
export const curriculumGenerationViewSchema = z.object({
  course: z.object({
    contentRevision: z.number().int().positive(),
    curriculumVersion: z.number().int().positive(),
    format: courseFormatSchema,
    generationId: z.string().nullable(),
    generationStatus: generationStatusSchema,
    id: z.uuid(),
    title: z.string(),
  }),
  needsGeneration: z.boolean(),
  status: z.literal("ready"),
});

export const chapterLessonViewsQuerySchema = z.object({
  view: z.enum(["all", "teaching", "curriculum"]).optional(),
});
export const chapterActivitiesQuerySchema = z.object({
  view: z.enum(["teaching", "curriculum"]).optional(),
});
export const chapterActivitiesResponseSchema = z.object({
  courseId: z.uuid(),
  groups: z.array(optionalActivitiesResponseSchema.extend({ title: z.string().nullable() })),
  reviews: z.array(lessonResourceSchema),
  status: z.literal("ready"),
});
