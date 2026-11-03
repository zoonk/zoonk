import { z } from "zod";

export const COMPLETED_LESSON_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 1000;

export const completedLessonListInputSchema = z
  .object({
    goalId: z.uuid().meta({ description: "The goal whose completed lessons to list" }),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(COMPLETED_LESSON_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type CompletedLessonListInput = z.infer<typeof completedLessonListInputSchema>;

export const completedLessonSchema = z
  .object({
    chapterTitle: z
      .string()
      .nullable()
      .meta({
        description: "The title of the lesson's chapter (a unit, for a language goal), or null",
      }),
    finishedOn: z.iso
      .date()
      .meta({
        description:
          "The learner-local day the learner last finished the lesson, as `YYYY-MM-DD`: a replay moves the lesson to its day",
      }),
    lessonId: z.uuid(),
    title: z.string().meta({ description: "The lesson's current title" }),
  })
  .meta({ id: "CompletedLesson" });

export type CompletedLesson = z.infer<typeof completedLessonSchema>;
