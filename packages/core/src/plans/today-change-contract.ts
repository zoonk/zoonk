import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";

/** A computed read has no database ID; its revision binds what the learner acknowledged. */
export const acknowledgeTodayPlanChangeInputSchema = z.discriminatedUnion("kind", [
  z.object({ changeId: z.uuid(), kind: z.literal("stored") }).strict(),
  z
    .object({
      goalId: z.uuid(),
      kind: z.literal("computed"),
      revision: z.string().regex(/^\d+$/u),
      shownDate: z.iso.date(),
      timeZone: answerTimeZoneSchema,
    })
    .strict(),
]);

export const acknowledgedTodayPlanChangeSchema = z
  .object({
    changeId: z.uuid(),
    revision: z.string().regex(/^\d+$/u),
    status: z.literal("acknowledged"),
    userId: z.uuid(),
  })
  .strict();

export type AcknowledgeTodayPlanChangeInput = z.infer<typeof acknowledgeTodayPlanChangeInputSchema>;
export type AcknowledgeTodayPlanChangeResult =
  | z.infer<typeof acknowledgedTodayPlanChangeSchema>
  | { status: "retryable" | "notFound" | "unauthorized" | "goalNotActive" | "otherDay" };
