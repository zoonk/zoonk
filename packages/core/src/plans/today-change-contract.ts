import { z } from "zod";

export const acknowledgeTodayPlanChangeInputSchema = z
  .object({ changeId: z.uuid(), kind: z.literal("stored") })
  .strict();

export const acknowledgedTodayPlanChangeSchema = z
  .object({ changeId: z.uuid(), status: z.literal("acknowledged") })
  .strict();

export type AcknowledgeTodayPlanChangeInput = z.infer<typeof acknowledgeTodayPlanChangeInputSchema>;
export type AcknowledgeTodayPlanChangeResult =
  | z.infer<typeof acknowledgedTodayPlanChangeSchema>
  | { status: "retryable" | "notFound" | "unauthorized" };
