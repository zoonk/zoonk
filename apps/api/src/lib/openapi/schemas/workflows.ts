import { z } from "zod";

export const courseGenerationTriggerSchema = z
  .object({
    courseSuggestionId: z
      .number()
      .int()
      .positive()
      .meta({ description: "Course suggestion ID to generate from" }),
  })
  .meta({ id: "CourseGenerationTrigger" });

export const chapterGenerationTriggerSchema = z
  .object({
    chapterId: z
      .number()
      .int()
      .positive()
      .meta({ description: "Chapter ID to generate content for" }),
  })
  .meta({ id: "ChapterGenerationTrigger" });

export const lessonGenerationTriggerSchema = z
  .object({
    lessonId: z
      .number()
      .int()
      .positive()
      .meta({ description: "Lesson ID to generate activities for" }),
  })
  .meta({ id: "LessonGenerationTrigger" });

export const activityGenerationTriggerSchema = z
  .object({
    lessonId: z
      .number()
      .int()
      .positive()
      .meta({ description: "Lesson ID to generate activities for" }),
  })
  .meta({ id: "ActivityGenerationTrigger" });

export const workflowTriggerResponseSchema = z
  .object({
    message: z.string().meta({ example: "Workflow started" }),
    runId: z.string().meta({ description: "Workflow run ID for status tracking" }),
  })
  .meta({ id: "WorkflowTriggerResponse" });

export const workflowStatusQuerySchema = z
  .object({
    runId: z.string().min(1).meta({ description: "Workflow run ID" }),
    startIndex: z.coerce
      .number()
      .int()
      .optional()
      .meta({ description: "Event index to start from" }),
  })
  .meta({ id: "WorkflowStatusQuery" });

export const activityGenerationRetrySchema = z
  .object({
    activityId: z
      .number()
      .int()
      .positive()
      .meta({ description: "Activity ID to retry generation for" }),
  })
  .meta({ id: "ActivityGenerationRetry" });
