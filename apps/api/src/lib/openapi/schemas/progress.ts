import { z } from "zod";

export const courseCompletionResponseSchema = z
  .object({
    chapters: z
      .array(
        z.object({
          chapterId: z.uuid().meta({ description: "Chapter ID" }),
          completedLessons: z
            .number()
            .int()
            .min(0)
            .meta({ description: "Number of completed lessons" }),
          totalLessons: z.number().int().min(0).meta({ description: "Total number of lessons" }),
        }),
      )
      .meta({ description: "Completion status per chapter" }),
    percentComplete: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .meta({ description: "Overall visible course completion percentage" }),
  })
  .meta({ id: "CourseCompletionResponse" });

export const chapterCompletionResponseSchema = z
  .object({
    lessons: z
      .array(
        z.object({
          isCompleted: z.boolean().meta({ description: "Whether the lesson is completed" }),
          lessonId: z.uuid().meta({ description: "Lesson ID" }),
        }),
      )
      .meta({ description: "Completion status per lesson" }),
    percentComplete: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .meta({ description: "Overall visible chapter completion percentage" }),
  })
  .meta({ id: "ChapterCompletionResponse" });

const nextLessonEmptyResponseSchema = z
  .object({
    completed: z.literal(false).meta({ description: "Whether all lessons are completed" }),
    hasStarted: z.literal(false).meta({ description: "Whether the user has started" }),
    type: z.literal("empty").meta({ description: "No next-learning target is available" }),
  })
  .strict()
  .meta({ id: "NextLessonEmptyResponse" });

const nextLessonChapterResponseSchema = z
  .object({
    canPrefetch: z
      .literal(false)
      .meta({ description: "Whether the next lesson can be prefetched" }),
    chapterId: z.uuid().meta({ description: "Chapter ID" }),
    chapterSlug: z.string().meta({ description: "Chapter slug" }),
    completed: z.literal(false).meta({ description: "Whether all lessons are completed" }),
    courseId: z.uuid().meta({ description: "Course ID" }),
    courseSlug: z.string().meta({ description: "Course slug" }),
    hasStarted: z.literal(true).meta({ description: "Whether the user has started" }),
    organizationSlug: z.string().meta({ description: "Organization slug" }),
    type: z.literal("chapter").meta({ description: "Continue at a chapter awaiting lessons" }),
  })
  .strict()
  .meta({ id: "NextLessonChapterResponse" });

const nextLessonLessonResponseSchema = z
  .object({
    canPrefetch: z.boolean().meta({ description: "Whether the next lesson can be prefetched" }),
    chapterId: z.uuid().meta({ description: "Chapter ID" }),
    chapterSlug: z.string().meta({ description: "Chapter slug" }),
    completed: z.boolean().meta({ description: "Whether all lessons are completed" }),
    courseId: z.uuid().meta({ description: "Course ID" }),
    courseSlug: z.string().meta({ description: "Course slug" }),
    hasStarted: z.boolean().meta({ description: "Whether the user has started" }),
    lessonId: z.uuid().meta({ description: "Lesson ID" }),
    lessonPosition: z.number().int().min(0).meta({ description: "Lesson position in the chapter" }),
    lessonSlug: z.string().meta({ description: "Lesson slug" }),
    organizationSlug: z.string().meta({ description: "Organization slug" }),
    type: z.literal("lesson").meta({ description: "Continue at a concrete lesson" }),
  })
  .strict()
  .meta({ id: "NextLessonLessonResponse" });

export const nextLessonResponseSchema = z
  .discriminatedUnion("type", [
    nextLessonEmptyResponseSchema,
    nextLessonChapterResponseSchema,
    nextLessonLessonResponseSchema,
  ])
  .meta({
    id: "NextLessonResponse",
    override: ({ jsonSchema }) => {
      jsonSchema.discriminator = {
        mapping: {
          chapter: "#/components/schemas/NextLessonChapterResponse",
          empty: "#/components/schemas/NextLessonEmptyResponse",
          lesson: "#/components/schemas/NextLessonLessonResponse",
        },
        propertyName: "type",
      };
    },
  });
