import {
  COMPLETED_LESSON_PAGE_SIZE,
  completedLessonFilterSchema,
  completedLessonListInputSchema,
  completedLessonSchema,
} from "@zoonk/core/completed-lessons/contract";
import { z } from "zod";
import { paginationSchema } from "./common";

const MAX_PAGE_SIZE = 100;

export const completedLessonListQuerySchema = completedLessonListInputSchema
  .omit({ offset: true })
  .extend({
    cursor: z.string().optional().meta({ description: "Opaque cursor returned in nextCursor" }),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(COMPLETED_LESSON_PAGE_SIZE),
  })
  .meta({ id: "CompletedLessonListQuery" });

export const completedLessonListResponseSchema = z
  .object({
    data: z.array(completedLessonSchema),
    filter: completedLessonFilterSchema
      .nullable()
      .meta({
        description:
          "What the list narrows to, the same on every page and for every `group`. Null while the list is short enough to read whole, or has lessons of fewer than two groups",
      }),
    pagination: paginationSchema,
  })
  .meta({ id: "CompletedLessonList" });
