import {
  dayTargetStatusSchema,
  openStudyDayInputSchema,
} from "@zoonk/core/sessions/open-day-contract";
import { z } from "zod";
import { logicalDateSchema, studyBlockSchema, studySessionResponseSchema } from "./study-sessions";

export const openStudyDayBodySchema = openStudyDayInputSchema.omit({ goalId: true });

export const openedStudyDayResponseSchema = z
  .object({
    actorId: z.uuid(),
    created: z.boolean(),
    goalId: z.uuid(),
    localDate: logicalDateSchema,
    revision: z.string().regex(/^\d+$/u),
    session: studySessionResponseSchema,
    sessionId: z.uuid(),
    status: z.literal("opened"),
    target: studyBlockSchema.nullable(),
    targetStatus: dayTargetStatusSchema.nullable(),
  })
  .meta({ id: "OpenedStudyDay" });
