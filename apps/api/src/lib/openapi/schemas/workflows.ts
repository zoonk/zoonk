import { z } from "zod";

const uuidParam = (description: string) => z.uuid().meta({ description });

export const courseGenerationTriggerSchema = z
  .object({ coursePromptId: uuidParam("Course prompt ID to generate from") })
  .meta({ id: "CourseGenerationTrigger" });

export const chapterGenerationTriggerSchema = z
  .object({ chapterId: uuidParam("Chapter ID to generate content for") })
  .meta({ id: "ChapterGenerationTrigger" });

export const lessonGenerationTriggerSchema = z
  .object({ lessonId: uuidParam("Lesson ID to generate content for") })
  .meta({ id: "LessonGenerationTrigger" });

export const lessonPreloadTriggerSchema = z
  .object({ lessonId: uuidParam("Lesson ID to preload content for") })
  .meta({ id: "LessonPreloadTrigger" });

export const workflowTriggerResponseSchema = z
  .object({
    message: z.string().meta({ examples: ["Workflow started"] }),
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
