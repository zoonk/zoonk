import "server-only";
import { type MemoryInsight, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getMemoryCacheTag } from "../../cache/tags";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getSession } from "../../users/get-session";
import { type MemoryInsightAnswerInput, type MemoryInsightView } from "../memory-contract";
import {
  type InsightPayload,
  readInsightPayload,
  toMemoryInsightView,
} from "./_utils/insight-view";

export type MemoryInsightAnswerResult =
  | { insight: MemoryInsightView; status: "updated" }
  | { status: "alreadyAnswered" | "notFound" | "unauthorized" };

type Answer = MemoryInsightAnswerInput["status"];

/** Accepting a schedule idea moves the goal's study time to the suggested one. */
async function moveStudyTime({
  goalId,
  studyTime,
  userId,
}: {
  goalId: string;
  studyTime: string;
  userId: string;
}): Promise<void> {
  await prisma.goal.updateMany({ data: { studyTime }, where: { id: goalId, userId } });
  revalidateCacheTags([getGoalsCacheTag(userId)]);
}

/**
 * What the answer means for the plan change: an applied lesson stays when accepted and is undone
 * when dismissed; a proposal is applied or declined. Null when there's nothing to do.
 */
function getPlanDecision({
  answer,
  payload,
}: {
  answer: Answer;
  payload: InsightPayload;
}): "applied" | "declined" | "undone" | null {
  if (payload.planChangeStatus === "proposed") {
    return answer === "accepted" ? "applied" : "declined";
  }

  return payload.planChangeStatus === "applied" && answer === "dismissed" ? "undone" : null;
}

/**
 * Applies what the answer means before it's recorded. The plan is the source of truth: when its
 * change already moved on (undone or decided from the plan screen), the planner refuses and the
 * answer is still recorded. Only a failure stops it, so the learner can answer again.
 */
async function applyAnswer({
  answer,
  goalId,
  insight,
  userId,
}: {
  answer: Answer;
  goalId: string;
  insight: MemoryInsight;
  userId: string;
}): Promise<void> {
  const payload = readInsightPayload(insight.payload);

  if (insight.kind === "scheduleIdea" && answer === "accepted" && payload.studyTime) {
    await moveStudyTime({ goalId, studyTime: payload.studyTime, userId });
  }

  const decision = insight.kind === "planChange" ? getPlanDecision({ answer, payload }) : null;

  if (decision && payload.planChangeId) {
    await decidePlanChange({ changeId: payload.planChangeId, goalId, input: { status: decision } });
  }
}

/**
 * The learner's answer to an insight on Today: accepting applies what it suggests (a new study
 * time, or keeping or adding a lesson), dismissing closes it (undoing or declining a lesson). Each
 * insight is answered once.
 */
export async function respondToMemoryInsight({
  input,
  insightId,
}: {
  input: MemoryInsightAnswerInput;
  insightId: string;
}): Promise<MemoryInsightAnswerResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(insightId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const insight = await prisma.memoryInsight.findFirst({
    where: { id: insightId, kind: { not: null }, message: { not: null }, userId },
  });

  if (!insight) {
    return { status: "notFound" };
  }

  if (insight.status !== "pending") {
    return { status: "alreadyAnswered" };
  }

  if (insight.goalId) {
    await applyAnswer({ answer: input.status, goalId: insight.goalId, insight, userId });
  }

  const { count } = await prisma.memoryInsight.updateMany({
    data: { respondedAt: new Date(), status: input.status },
    where: { id: insightId, status: "pending" },
  });

  if (count === 0) {
    return { status: "alreadyAnswered" };
  }

  revalidateCacheTags([getMemoryCacheTag(userId)]);

  const updated = await prisma.memoryInsight.findUniqueOrThrow({ where: { id: insightId } });
  const view = toMemoryInsightView(updated);

  return view ? { insight: view, status: "updated" } : { status: "notFound" };
}
