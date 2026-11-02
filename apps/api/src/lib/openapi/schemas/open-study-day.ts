import { studyBlockOpeningSchema } from "@zoonk/core/sessions/open-block-contract";
import {
  dayTargetStatusSchema,
  openStudyDayInputSchema,
} from "@zoonk/core/sessions/open-day-contract";
import { z } from "zod";
import { logicalDateSchema, studyBlockSchema, studySessionResponseSchema } from "./study-sessions";

export const openStudyDayBodySchema = openStudyDayInputSchema.omit({ goalId: true });

export const openedStudyDayResponseSchema = z
  .object({
    created: z.boolean(),
    goalId: z.uuid(),
    localDate: logicalDateSchema,
    opening: studyBlockOpeningSchema
      .nullable()
      .meta({
        description:
          "Where the target opens, as `POST /v1/study-block-openings` would open it, so a tap on a day not saved yet is one request. Null when no target was asked for or it can't start (`targetStatus`). `session` and `target` show the day as it opened, before this start",
      }),
    session: studySessionResponseSchema,
    sessionId: z.uuid(),
    status: z.literal("opened"),
    target: studyBlockSchema.nullable(),
    targetStatus: dayTargetStatusSchema.nullable(),
  })
  .meta({ id: "OpenedStudyDay" });
