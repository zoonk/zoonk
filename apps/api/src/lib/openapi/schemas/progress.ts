import { z } from "zod";

export const activityCompletionQuerySchema = z
  .object({
    lessonId: z.coerce.number().int().positive().meta({ description: "Lesson ID" }),
  })
  .meta({ id: "ActivityCompletionQuery" });

export const activityCompletionResponseSchema = z
  .object({
    completedActivityIds: z
      .array(z.string())
      .meta({ description: "IDs of completed activities in the lesson" }),
  })
  .meta({ id: "ActivityCompletionResponse" });

export const nextActivityQuerySchema = z
  .object({
    chapterId: z.coerce.number().int().positive().optional().meta({ description: "Chapter ID" }),
    courseId: z.coerce.number().int().positive().optional().meta({ description: "Course ID" }),
    lessonId: z.coerce.number().int().positive().optional().meta({ description: "Lesson ID" }),
  })
  .refine(
    (data) => {
      const provided = [data.courseId, data.chapterId, data.lessonId].filter(
        (value) => value !== undefined,
      );
      return provided.length === 1;
    },
    { message: "Exactly one of courseId, chapterId, or lessonId must be provided" },
  )
  .meta({ id: "NextActivityQuery" });

export const nextActivityResponseSchema = z
  .object({
    activityPosition: z
      .number()
      .optional()
      .meta({ description: "Activity position in the lesson" }),
    brandSlug: z.string().optional().meta({ description: "Organization slug" }),
    chapterSlug: z.string().optional().meta({ description: "Chapter slug" }),
    completed: z.boolean().meta({ description: "Whether all activities are completed" }),
    courseSlug: z.string().optional().meta({ description: "Course slug" }),
    hasStarted: z.boolean().meta({ description: "Whether the user has started" }),
    lessonSlug: z.string().optional().meta({ description: "Lesson slug" }),
  })
  .meta({ id: "NextActivityResponse" });
