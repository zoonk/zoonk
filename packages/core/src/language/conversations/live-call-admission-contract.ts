import {
  LiveCallAdmission,
  LiveCallCostConfidence,
  LiveCallEndReason,
  LiveCallState,
} from "@zoonk/db/live-call-enums";
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
    cleanupBlocking: z.boolean(),
    closeAttempts: z.int().min(0),
    closedAt: nullableDate,
    conversationId: z.uuid(),
    costConfidence: z.enum(LiveCallCostConfidence),
    createdAt: z.iso.datetime(),
    deadlineAt: z.iso.datetime(),
    endReason: z.enum(LiveCallEndReason).nullable(),
    generation: z.int().positive(),
    heldSeconds: z.int().min(0),
    id: z.uuid(),
    lastCloseAt: nullableDate,
    liabilityMicros: z.int().min(0),
    overdue: z.boolean(),
    providerSessionId: z.string().nullable(),
    providerStartedAt: nullableDate,
    recoveryUnconfirmedAt: nullableDate,
    reservedMicros: z.int().min(0),
    settledMicros: z.int().min(0),
    state: z.enum(LiveCallState),
    updatedAt: z.iso.datetime(),
    userId: z.uuid(),
    workflowRunId: z.string().nullable(),
  })
  .meta({ id: "LiveCallAdminConnection" });

/** JSON transport: the API serializes Date values before validation/response, Admin parses here. */
export const liveCallAdmissionResponseSchema = z
  .object({
    cleanupHealthy: z.boolean(),
    connections: z.array(liveCallAdminConnectionSchema),
    providerAvailable: z.boolean(),
    setting: liveCallAdmissionInputSchema,
  })
  .meta({ id: "LiveCallAdmissionResponse" });

export const liveCallCloseAllResponseSchema = z
  .object({ attempted: z.int().min(0), closed: z.int().min(0), remaining: z.int().min(0) })
  .meta({ id: "LiveCallCloseAllResponse" });
