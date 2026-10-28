import { type MemoryInsight, prisma } from "@zoonk/db";
import { z } from "zod";
import { changeGoalSelect, toPlanChangeView } from "../../../plans/_utils/plan-change-view";
import { type MemoryInsightView } from "../../memory-contract";

const insightPayloadSchema = z.object({
  lessonFocus: z.string().optional(),
  planChangeId: z.string().optional(),
  planChangeStatus: z.enum(["applied", "proposed"]).optional(),
  skillId: z.string().optional(),
  studyTime: z.string().optional(),
});

export type InsightPayload = z.infer<typeof insightPayloadSchema>;

export function readInsightPayload(value: unknown): InsightPayload {
  const payload = insightPayloadSchema.safeParse(value);
  return payload.success ? payload.data : {};
}

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
        include: { plan: { select: { goal: { select: changeGoalSelect }, version: true } } },
        where: { id: planChangeId, plan: { goal: { userId: insight.userId } } },
      })
    : null;

  const view =
    change &&
    (await toPlanChangeView({ change, goal: change.plan.goal, planVersion: change.plan.version }));

  const planChange =
    change && view && (change.status === "proposed" || change.status === "applied")
      ? { canApply: view.canApply, effect: view.effect, id: change.id, status: change.status }
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
