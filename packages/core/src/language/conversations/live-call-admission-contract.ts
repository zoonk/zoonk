import { LiveCallAdmission, LiveCallEndReason, LiveCallState } from "@zoonk/db/live-call-enums";
import { z } from "zod";

const MAX_BUDGET_MICROS = 2_000_000_000;
const nullableDate = z.iso.datetime().nullable();

export const liveCallAdmissionInputSchema = z
  .object({
    admission: z.enum(LiveCallAdmission),
    freeDailyBudgetMicros: z.int().min(0).max(MAX_BUDGET_MICROS),
  })
  .strict()
  .meta({ id: "LiveCallAdmissionInput" });
export type LiveCallAdmissionInput = z.infer<typeof liveCallAdmissionInputSchema>;

const liveCallAdminConnectionSchema = z
  .object({
    conversationId: z.uuid(),
    costMicros: z.int().min(0).meta({ description: "What the connection reserved" }),
    createdAt: z.iso.datetime(),
    deadlineAt: z.iso.datetime(),
    endReason: z.enum(LiveCallEndReason).nullable(),
    exposureMicros: z
      .int()
      .min(0)
      .meta({
        description:
          "What it may have cost so far: its reservation or its clock, whichever is more",
      }),
    heldSeconds: z.int().min(0),
    id: z.uuid(),
    overdue: z.boolean().meta({ description: "Open more than a minute past its deadline" }),
    providerSessionId: z.string().nullable(),
    startedAt: nullableDate,
    state: z.enum(LiveCallState),
    userId: z.uuid(),
  })
  .meta({ id: "LiveCallAdminConnection" });

export const liveCallAdmissionResponseSchema = z
  .object({
    connections: z.array(liveCallAdminConnectionSchema),
    providerAvailable: z.boolean(),
    setting: liveCallAdmissionInputSchema,
  })
  .meta({ id: "LiveCallAdmissionResponse" });
