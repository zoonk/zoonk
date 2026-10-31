import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { loadNoticeDay } from "../exams/_utils/notice-day";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { examEditionSchema } from "../library/exams/blueprint-contract";
import { proposeChange } from "./_utils/apply-plan-change";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext } from "./_utils/plan-context";
import { endPlanSetupTask, endPlanSetupTaskWith } from "./_utils/plan-setup-tasks";
import { loadPlanAtToken } from "./_utils/plan-token";
import { revalidatePlanTags } from "./_utils/replan";
import { NOTICE_SOURCE } from "./plan-change-contract";
import { withPlanRetry } from "./plan-conflict";
import { type PlanOperation } from "./plan-contract";
import { type NoticeDay } from "./plan-view-contract";
import { toIsoDate } from "./planner/plan-calendar";
import { type PlanGraph } from "./planner/plan-state";

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

async function getNoticeEdition(examBlueprintId: string | null): Promise<string | null> {
  const blueprint = examBlueprintId
    ? await prisma.examBlueprint.findUnique({
        select: { edition: true },
        where: { id: examBlueprintId },
      })
    : null;

  const edition = examEditionSchema.safeParse(blueprint?.edition).data;

  return edition?.sourceHash ?? (edition?.year ? String(edition.year) : null);
}

async function loadEarlierNoticeChanges(planId: string) {
  const changes = await prisma.planChange.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, payload: true, status: true },
    where: {
      payload: { equals: NOTICE_SOURCE, path: ["source"] },
      planId,
      status: { in: ["declined", "proposed"] },
    },
  });

  const parsed = changes.map((change) => ({
    ...parsePlanChangePayload(change.payload),
    id: change.id,
    status: change.status,
  }));

  const waiting = parsed.filter((change) => change.status === "proposed");

  const waitingGraph =
    waiting.find((change) => change.operations.some(({ kind }) => kind === "followNotice"))
      ?.noticeGraph ?? null;

  return {
    keptEditions: new Set(
      parsed
        .filter(
          (change) =>
            change.status === "declined" &&
            change.operations.some((operation) => operation.kind === "followNotice"),
        )
        .map((change) => change.noticeEdition),
    ),
    waitingGraph,
    waitingIds: waiting.map((change) => change.id),
  };
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
  graph?: PlanGraph | null;
  noticeId?: string | null;
};

async function proposeForGoal({
  extraWrites,
  graph,
  goalId,
  noticeId,
}: NoticeChangeRequest & {
  graph: PlanGraph | null;
  noticeId: string | null;
}): Promise<NoticeChangeOutcome> {
  const loaded = await loadPlanAtToken(goalId);
  const context = loaded?.goal.status === "active" ? loaded : null;

  if (!context || context.state.graph.skills.length === 0) {
    return "none";
  }

  const [earlier, day, edition] = await Promise.all([
    loadEarlierNoticeChanges(context.plan.id),
    findNoticeDay(context),
    getNoticeEdition(context.goal.examBlueprintId),
  ]);

  const noticeGraph = earlier.keptEditions.has(edition) ? null : (graph ?? earlier.waitingGraph);
  const keepsWaitingGraph = graph === null && noticeGraph !== null;

  const operations: PlanOperation[] = [
    ...(noticeGraph ? [{ kind: "followNotice" as const }] : []),
    ...(day
      ? [{ estimated: day.estimated, kind: "setNoticeDate" as const, targetDate: day.date }]
      : []),
  ];

  const proposed =
    operations.length > 0
      ? await proposeChange({
          approval: "always",
          context,
          extraWrites,
          notice: { edition, graph: noticeGraph, noticeId },
          operations,
          reason: keepsWaitingGraph ? APP_SAID_REASON : await loadNoticeMessage(noticeId),
          source: NOTICE_SOURCE,
        })
      : null;

  const changesNothing = proposed === null || proposed.status === "unchanged";

  if (earlier.waitingIds.length > 0 && changesNothing) {
    await writeLearnerChange({ userId: context.goal.userId }, async (tx) => {
      const updated = await tx.planChange.updateMany({
        data: { status: "replaced" },
        where: { id: { in: earlier.waitingIds }, planId: context.plan.id, status: "proposed" },
      });

      if (updated.count === 0) {
        return unchanged(null);
      }
    });

    revalidatePlanTags(context.goal.userId);
  }

  return proposed?.status === "proposed" ? "proposed" : "none";
}

/**
 * Nothing about the goal's date or structure changes until the learner applies it. Workflow bridge
 * for research and freshness.
 */
export function proposeNoticeChange({
  graph = null,
  noticeId = null,
  ...request
}: NoticeChangeRequest): Promise<NoticeChangeOutcome> {
  return withPlanRetry(() => proposeForGoal({ ...request, graph, noticeId }));
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
