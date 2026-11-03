import {
  COMPLETED_LESSON_PAGE_SIZE,
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
  .object({ data: z.array(completedLessonSchema), pagination: paginationSchema })
  .meta({ id: "CompletedLessonList" });
