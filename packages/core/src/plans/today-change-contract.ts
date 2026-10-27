import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";

/**
 * The plan a notice Today worked out was computed from: its saved version and input version. The
 * same plan and day work out the same notice, so acknowledging with them saves only what was shown.
 */
export const noticeBasisSchema = z
  .object({ inputVersion: z.number().int().nonnegative(), version: z.number().int().positive() })
  .strict()
  .meta({
    description:
      "The plan version and input version a computed notice was worked out from, as Today's `noticeBasis` returns them",
    id: "NoticeBasis",
  });

export type NoticeBasis = z.infer<typeof noticeBasisSchema>;

/** A computed read has no database ID; the plan it was worked out from binds what was acknowledged. */
export const acknowledgeTodayPlanChangeInputSchema = z.discriminatedUnion("kind", [
  z.object({ changeId: z.uuid(), kind: z.literal("stored") }).strict(),
  z
    .object({
      basis: noticeBasisSchema,
      goalId: z.uuid(),
      kind: z.literal("computed"),
      shownDate: z.iso.date(),
      timeZone: answerTimeZoneSchema,
    })
    .strict(),
]);

export const acknowledgedTodayPlanChangeSchema = z
  .object({ changeId: z.uuid(), status: z.literal("acknowledged") })
  .strict();

export type AcknowledgeTodayPlanChangeInput = z.infer<typeof acknowledgeTodayPlanChangeInputSchema>;
export type AcknowledgeTodayPlanChangeResult =
  | z.infer<typeof acknowledgedTodayPlanChangeSchema>
  | { status: "retryable" | "notFound" | "unauthorized" | "goalNotActive" | "otherDay" };
