import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";
import { type StudyBlockView, type StudySessionView } from "./_utils/session-view";
import { dayBlockRefSchema } from "./day-block";
import { type StudyBlockOpening } from "./open-block-contract";

export const openStudyDayInputSchema = z
  .object({
    goalId: z.uuid(),
    keepEmpty: z.boolean().optional(),
    shownDate: z.iso.date(),
    target: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("next"), shown: dayBlockRefSchema.nullable() }).strict(),
        z.object({ kind: z.literal("ref"), ref: dayBlockRefSchema }).strict(),
      ])
      .optional(),
    timeZone: answerTimeZoneSchema,
  })
  .strict();

export type OpenStudyDayInput = z.infer<typeof openStudyDayInputSchema>;
export type OpenDayTarget = NonNullable<OpenStudyDayInput["target"]>;
export const dayTargetStatusSchema = z.enum([
  "next",
  "resolved",
  "changed",
  "gone",
  "ambiguous",
  "notStartable",
  "otherDay",
]);
export type DayTargetStatus = z.infer<typeof dayTargetStatusSchema>;

/**
 * An opened result contains only real persisted IDs; logical refs are resolved after the write.
 * `opening` is where a startable target opens, as `openStudyBlock` would open it; `session` and
 * `target` show the day before that start.
 */
export type OpenStudyDayResult =
  | {
      created: boolean;
      goalId: string;
      localDate: Date;
      opening: StudyBlockOpening | null;
      session: StudySessionView;
      sessionId: string;
      status: "opened";
      target: StudyBlockView | null;
      targetStatus: DayTargetStatus | null;
    }
  | { goalId: string; localDate: Date; status: "empty" | "retryable" }
  | { status: "unauthorized" | "notFound" | "goalNotActive" | "preparing" };
