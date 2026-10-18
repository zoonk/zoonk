import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";
import { type StudyBlockView, type StudySessionView } from "./_utils/session-view";
import { dayBlockRefSchema } from "./day-block";

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

/** An opened result contains only real persisted IDs; logical refs are resolved after the write. */
export type OpenStudyDayResult =
  | {
      actorId: string;
      created: boolean;
      goalId: string;
      localDate: Date;
      revision: string;
      session: StudySessionView;
      sessionId: string;
      status: "opened";
      target: StudyBlockView | null;
      targetStatus: DayTargetStatus | null;
    }
  | {
      actorId: string;
      goalId: string;
      localDate: Date;
      revision: string;
      status: "empty" | "retryable";
    }
  | { status: "unauthorized" | "notFound" | "goalNotActive" | "preparing" };
