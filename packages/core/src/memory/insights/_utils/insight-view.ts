import { type MemoryInsight } from "@zoonk/db";
import { z } from "zod";
import { planEffectSchema } from "../../../plans/_utils/plan-change-payload";
import { type MemoryInsightView } from "../../memory-contract";

/** What accepting an insight needs, stored with it: the suggested time or the plan change. */
const insightPayloadSchema = z.object({
  /** What the plan change does to the plan, as the planner computed it when proposing. */
  effect: planEffectSchema.nullable().optional(),
  lessonFocus: z.string().optional(),
  planChangeId: z.string().optional(),
  /** Whether the planner added a one-lesson gap at once (with an undo) or a bigger one waits for an OK. */
  planChangeStatus: z.enum(["applied", "proposed"]).optional(),
  skillId: z.string().optional(),
  studyTime: z.string().optional(),
});

export type InsightPayload = z.infer<typeof insightPayloadSchema>;

export function readInsightPayload(value: unknown): InsightPayload {
  const payload = insightPayloadSchema.safeParse(value);
  return payload.success ? payload.data : {};
}

/** Null for a check that found nothing worth saying, which is never shown. */
export function toMemoryInsightView(insight: MemoryInsight): MemoryInsightView | null {
  if (!insight.kind || !insight.message) {
    return null;
  }

  const payload = readInsightPayload(insight.payload);
  const { effect = null, planChangeId, planChangeStatus } = payload;

  return {
    createdAt: insight.createdAt,
    goalId: insight.goalId,
    id: insight.id,
    kind: insight.kind,
    message: insight.message,
    planChange:
      planChangeId && planChangeStatus
        ? { effect, id: planChangeId, status: planChangeStatus }
        : null,
    status: insight.status,
    studyTime: payload.studyTime ?? null,
  };
}
