import { type MemoryInsight, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { getRequestInstant } from "../../../learner/facts/request-instant";
import { parsePlanChangePayload } from "../../../plans/_utils/plan-change-payload";
import { isCurrentPlanPreview } from "../../../plans/_utils/plan-preview-basis";
import { type MemoryInsightView } from "../../memory-contract";

/** What accepting an insight needs, stored with it: the suggested time or the plan change. */
const insightPayloadSchema = z.object({
  /** What the plan change does to the plan, as the planner computed it when proposing. */
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
export async function toMemoryInsightView(
  insight: MemoryInsight,
): Promise<MemoryInsightView | null> {
  if (!insight.kind || !insight.message) {
    return null;
  }

  const payload = readInsightPayload(insight.payload);
  const { planChangeId } = payload;

  const change = planChangeId
    ? await prisma.planChange.findFirst({
        include: { plan: { include: { goal: true } } },
        where: { id: planChangeId, plan: { goal: { userId: insight.userId } } },
      })
    : null;

  const quoted = change && parsePlanChangePayload(change.payload);

  if (change?.status === "proposed") {
    const timeZone = getAnswerTimeZone({ goal: change.plan.goal });
    const today = getDateInTimeZone({ date: await getRequestInstant(), timeZone });

    if (
      !quoted?.effect ||
      !isCurrentPlanPreview({
        basis: quoted.previewBasis,
        context: { plan: change.plan, timeZone, today },
      })
    ) {
      return null;
    }
  }

  const planChange =
    change && (change.status === "proposed" || change.status === "applied")
      ? { effect: quoted?.effect ?? null, id: change.id, status: change.status }
      : null;

  return {
    createdAt: insight.createdAt,
    goalId: insight.goalId,
    id: insight.id,
    kind: insight.kind,
    message: insight.message,
    planChange,
    status: insight.status,
    studyTime: payload.studyTime ?? null,
  };
}
