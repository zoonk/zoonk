import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const acknowledgeTodayPlanChangeInputSchema = z
  .object({ changeId: uuidSchema(), kind: z.literal("stored") })
  .strict();

export const acknowledgedTodayPlanChangeSchema = z
  .object({ changeId: uuidSchema(), status: z.literal("acknowledged") })
  .strict();

export type AcknowledgeTodayPlanChangeInput = z.infer<typeof acknowledgeTodayPlanChangeInputSchema>;
export type AcknowledgeTodayPlanChangeResult =
  | z.infer<typeof acknowledgedTodayPlanChangeSchema>
  | { status: "retryable" | "notFound" | "unauthorized" };
