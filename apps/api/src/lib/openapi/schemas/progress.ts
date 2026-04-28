import { z } from "zod";

const uuidQuery = (description: string) => z.uuid().meta({ description });

export const lessonCompletionQuerySchema = z
  .object({
    lessonId: uuidQuery("Lesson ID"),
  })
  .meta({ id: "LessonCompletionQuery" });

export const lessonCompletionResponseSchema = z
  .object({
    completedLessonIds: z
      .array(z.string())
      .meta({ description: "IDs of completed lessons in the lesson" }),
  })
  .meta({ id: "LessonCompletionResponse" });

export const courseCompletionQuerySchema = z
  .object({
    courseId: uuidQuery("Course ID"),
  })
  .meta({ id: "CourseCompletionQuery" });

export const courseCompletionResponseSchema = z
  .object({
    chapters: z
      .array(
        z.object({
          chapterId: z.string().meta({ description: "Chapter ID" }),
          completedLessons: z.number().meta({ description: "Number of completed lessons" }),
          totalLessons: z.number().meta({ description: "Total number of lessons" }),
        }),
      )
      .meta({ description: "Completion status per chapter" }),
  })
  .meta({ id: "CourseCompletionResponse" });

export const chapterCompletionQuerySchema = z
  .object({
    chapterId: uuidQuery("Chapter ID"),
  })
  .meta({ id: "ChapterCompletionQuery" });

export const chapterCompletionResponseSchema = z
  .object({
    lessons: z
      .array(
        z.object({
          completedLessons: z.number().meta({ description: "Number of completed lessons" }),
          lessonId: z.string().meta({ description: "Lesson ID" }),
          totalLessons: z.number().meta({ description: "Total number of lessons" }),
        }),
      )
      .meta({ description: "Completion status per lesson" }),
  })
  .meta({ id: "ChapterCompletionResponse" });

export const nextLessonQuerySchema = z
  .object({
    chapterId: uuidQuery("Chapter ID").optional(),
    courseId: uuidQuery("Course ID").optional(),
    lessonId: uuidQuery("Lesson ID").optional(),
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
  .meta({ id: "NextLessonQuery" });

export const nextLessonResponseSchema = z
  .object({
    brandSlug: z.string().optional().meta({ description: "Organization slug" }),
    chapterSlug: z.string().optional().meta({ description: "Chapter slug" }),
    completed: z.boolean().meta({ description: "Whether all lessons are completed" }),
    courseSlug: z.string().optional().meta({ description: "Course slug" }),
    hasStarted: z.boolean().meta({ description: "Whether the user has started" }),
    lessonPosition: z.number().optional().meta({ description: "Lesson position in the lesson" }),
    lessonSlug: z.string().optional().meta({ description: "Lesson slug" }),
  })
  .meta({ id: "NextLessonResponse" });
