import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { loadNoticeDay } from "../exams/_utils/notice-day";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { proposeChange } from "./_utils/apply-plan-change";
import { noticeGraphPayload } from "./_utils/notice-graph-proposal";
import { type PlanContext } from "./_utils/plan-context";
import { endPlanSetupTask, endPlanSetupTaskWith } from "./_utils/plan-setup-tasks";
import { loadPlanAtToken } from "./_utils/plan-token";
import { revalidatePlanTags } from "./_utils/replan";
import { applyNoticeGraph } from "./apply-notice-graph";
import { NOTICE_SOURCE } from "./plan-change-contract";
import { withPlanRetry } from "./plan-conflict";
import { type NoticeDay } from "./plan-view-contract";
import { toIsoDate } from "./planner/plan-calendar";
import { planGraphSchema } from "./planner/plan-state";

const NOTICE_GOALS_PAGE = 50;

/** Stored in `reason` when the app words the change itself from its source and operations. */
const APP_SAID_REASON = "";

export type NoticeChangeOutcome = "none" | "proposed";

function findNoticeDay(context: PlanContext): Promise<NoticeDay | null> {
  const { goal, state } = context;

  return loadNoticeDay({
    goal,
    goalDate: state.goal.targetDate,
    noticeDate: state.settings.noticeDate,
    today: toIsoDate(context.today),
  });
}

async function loadNoticeMessage(noticeId: string | null): Promise<string> {
  if (!noticeId) {
    return APP_SAID_REASON;
  }

  const notice = await prisma.sourceChangeNotice.findUnique({
    select: { message: true },
    where: { id: noticeId },
  });

  return notice?.message ?? APP_SAID_REASON;
}

type NoticeChangeRequest = {
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  goalId: string;
  noticeId?: string | null;
};

async function replaceNoticeProposals({
  context,
  graphOnly,
}: {
  context: PlanContext;
  graphOnly: boolean;
}): Promise<void> {
  const waiting = await prisma.planChange.findMany({
    select: { id: true },
    where: {
      AND: graphOnly ? { payload: noticeGraphPayload } : undefined,
      payload: { equals: NOTICE_SOURCE, path: ["source"] },
      planId: context.plan.id,
      status: "proposed",
    },
  });

  const ids = waiting.map((change) => change.id);

  if (ids.length === 0) {
    return;
  }

  await writeLearnerChange({ userId: context.goal.userId }, async (tx) => {
    const updated = await tx.planChange.updateMany({
      data: { status: "replaced" },
      where: { id: { in: ids }, planId: context.plan.id, status: "proposed" },
    });

    if (updated.count === 0) {
      return unchanged(null);
    }
  });

  revalidatePlanTags(context.goal.userId);
}

async function proposeForGoal({
  extraWrites,
  goalId,
  noticeId = null,
}: NoticeChangeRequest): Promise<NoticeChangeOutcome> {
  const context = await loadPlanAtToken(goalId);

  if (!context || context.goal.status !== "active" || context.state.graph.skills.length === 0) {
    return "none";
  }

  const day = await findNoticeDay(context);

  if (!day) {
    await replaceNoticeProposals({ context, graphOnly: false });
    return "none";
  }

  const proposed = await proposeChange({
    approval: "always",
    context,
    extraWrites,
    noticeId,
    operations: [{ estimated: day.estimated, kind: "setNoticeDate", targetDate: day.date }],
    reason: await loadNoticeMessage(noticeId),
    source: NOTICE_SOURCE,
  });

  if (proposed.status === "unchanged" || proposed.status === "notDue") {
    await replaceNoticeProposals({ context, graphOnly: true });
  }

  return proposed.status === "proposed" ? "proposed" : "none";
}

async function landWaitingNoticeGraph(goalId: string): Promise<boolean> {
  const waiting = await prisma.planChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { payload: true, plan: { select: { goal: { select: { examBlueprintId: true } } } } },
    where: {
      AND: { payload: noticeGraphPayload },
      payload: { equals: NOTICE_SOURCE, path: ["source"] },
      plan: { goalId },
      status: "proposed",
    },
  });

  const payload = waiting?.payload;
  const blueprintId = waiting?.plan.goal.examBlueprintId;
  const graph = isJsonObject(payload) ? planGraphSchema.safeParse(payload.noticeGraph).data : null;

  if (blueprintId && graph?.skills.length) {
    await applyNoticeGraph({ blueprintId, goalId, graph, legacy: true });
  }

  return waiting !== null;
}

export async function proposeNoticeChange(
  request: NoticeChangeRequest,
): Promise<NoticeChangeOutcome> {
  await landWaitingNoticeGraph(request.goalId);
  return withPlanRetry(() => proposeForGoal(request));
}

export async function retireWaitingNoticeGraph(goalId: string): Promise<void> {
  if (await landWaitingNoticeGraph(goalId)) {
    await withPlanRetry(() => proposeForGoal({ goalId }));
  }
}

export async function askAboutNoticeDay(goalId: string): Promise<void> {
  const task = { goalId, task: "notice" as const };
  const outcome = await proposeNoticeChange({ extraWrites: endPlanSetupTaskWith(task), goalId });

  if (outcome === "none") {
    await endPlanSetupTask(task);
  }
}

/** Workflow bridge for the workflows that read notices. */
export async function listNoticeGoals({
  after,
  examBlueprintId,
  exceptGoalId,
}: {
  after: string | null;
  examBlueprintId: string;
  exceptGoalId: string | null;
}): Promise<{ goalIds: string[]; next: string | null }> {
  const goals = await prisma.goal.findMany({
    orderBy: { id: "asc" },
    select: { id: true },
    take: NOTICE_GOALS_PAGE,
    where: {
      examBlueprintId,
      kind: "exam",
      plan: { isNot: null },
      status: "active",
      ...(after || exceptGoalId
        ? {
            id: { ...(after ? { gt: after } : {}), ...(exceptGoalId ? { not: exceptGoalId } : {}) },
          }
        : {}),
    },
  });

  const goalIds = goals.map((goal) => goal.id);

  return { goalIds, next: goalIds.length === NOTICE_GOALS_PAGE ? (goalIds.at(-1) ?? null) : null };
}

export async function listNoticeRepairBlueprints(after: string | null): Promise<string[]> {
  const rows = await prisma.examBlueprint.findMany({
    orderBy: { id: "asc" },
    select: { id: true },
    take: NOTICE_GOALS_PAGE,
    where: {
      ...(after && { id: { gt: after } }),
      OR: [
        { skillGraph: { isNot: null } },
        { goals: { some: { kind: "exam", plan: { isNot: null }, status: "active" } } },
      ],
    },
  });

  return rows.map((row) => row.id);
}
