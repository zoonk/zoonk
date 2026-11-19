import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const COMPLETED_LESSON_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 1000;

export const completedLessonListInputSchema = z
  .object({
    goalId: uuidSchema().meta({ description: "The goal whose completed lessons to list" }),
    group: z
      .string()
      .min(1)
      .optional()
      .meta({
        description:
          "Lists only the lessons of this group, by a `key` from `filter.groups`; a key the goal doesn't have lists every lesson",
      }),
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
    group: z
      .string()
      .nullable()
      .meta({
        description:
          "The `key` of its group in `filter.groups`. Null when the list has no `filter`, or the lesson is in none of the plan's groups",
      }),
    lessonId: uuidSchema(),
    title: z.string().meta({ description: "The lesson's current title" }),
  })
  .meta({ id: "CompletedLesson" });

export type CompletedLesson = z.infer<typeof completedLessonSchema>;

const completedLessonGroupSchema = z
  .object({
    key: z.string().meta({ description: "Names the group in `group`" }),
    lessons: z.int().min(1).meta({ description: "The completed lessons in it" }),
    name: z.string(),
  })
  .meta({ id: "CompletedLessonGroup" });

export const completedLessonFilterSchema = z
  .object({
    groups: z
      .array(completedLessonGroupSchema)
      .meta({
        description:
          "The groups with completed lessons, the one with the most first. A lesson of none of the plan's groups counts only in `total`",
      }),
    kind: z
      .enum(["subjects", "modules", "phases"])
      .meta({
        description:
          "What the plan groups its lessons by: an exam's `subjects`, another goal's `modules`, or its `phases` when it has fewer than two of those",
      }),
    total: z.int().min(0).meta({ description: "Every completed lesson, whatever `group` asked" }),
  })
  .meta({ id: "CompletedLessonFilter" });

export type CompletedLessonFilter = z.infer<typeof completedLessonFilterSchema>;
