import "server-only";
import { prisma } from "@zoonk/db";
import { getExamEditionDays, readExamMonth, readExamYear } from "../exams/_utils/exam-edition-days";
import { examEditionSchema } from "../library/exams/blueprint-contract";
import { proposeChange } from "./_utils/apply-plan-change";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext, loadPlanContext } from "./_utils/plan-context";
import { revalidatePlanTags, withPlanRetry } from "./_utils/replan";
import { NOTICE_SOURCE } from "./plan-change-contract";
import { type PlanOperation } from "./plan-contract";
import { toIsoDate } from "./planner/plan-calendar";
import { type PlanGraph } from "./planner/plan-state";

/** Goals a check's proposals go through per step, so a popular exam never makes one long step. */
const NOTICE_GOALS_PAGE = 50;

/** Stored in `reason` when the app says the change itself, from its source and operations. */
const APP_SAID_REASON = "";

export type NoticeChangeOutcome = "none" | "proposed";

/**
 * The exam day the goal's notice gives, after the learner's today, when it isn't the goal's date:
 * the official day, for any goal; the estimated one (`estimated`), only for a goal whose date is
 * the notice's (or that has none), never over a date the learner set.
 */
async function findNoticeDay(
  context: PlanContext,
): Promise<{ estimated: boolean; targetDate: string } | null> {
  const { goal, state } = context;

  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({
    select: { edition: true },
    where: { id: goal.examBlueprintId },
  });

  const today = toIsoDate(context.today);

  const { days, estimated } = getExamEditionDays({
    edition: examEditionSchema.safeParse(blueprint?.edition).data ?? null,
    examMonth: readExamMonth(goal.details),
    examYear: readExamYear(goal.details),
    from: today,
  });

  const next = days.find((day) => day.date > today)?.date ?? null;
  const goalDate = state.goal.targetDate;
  const isNoticeDated = goalDate === null || goalDate === state.settings.noticeDate;

  if (!next || next === goalDate || (estimated && !isNoticeDated)) {
    return null;
  }

  return { estimated, targetDate: next };
}

/**
 * The notice's changes the learner kept their own plan over, and the ones still waiting, with the
 * newest graph one of those waiting proposes (`waitingGraph`).
 */
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

  const declined = parsed
    .filter((change) => change.status === "declined")
    .flatMap((change) => change.operations);

  const waiting = parsed.filter((change) => change.status === "proposed");

  const waitingGraph =
    waiting.find((change) => change.operations.some(({ kind }) => kind === "followNotice"))
      ?.noticeGraph ?? null;

  return {
    keptDates: new Set(
      declined.flatMap((operation) =>
        operation.kind === "setNoticeDate" ? [operation.targetDate] : [],
      ),
    ),
    keptPlan: declined.some((operation) => operation.kind === "followNotice"),
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

async function proposeForGoal({
  graph,
  goalId,
  noticeId,
}: {
  graph: PlanGraph | null;
  goalId: string;
  noticeId: string | null;
}): Promise<NoticeChangeOutcome> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  const context = goal?.status === "active" ? await loadPlanContext({ goal }) : null;

  if (!context || context.state.graph.skills.length === 0) {
    return "none";
  }

  const [earlier, day] = await Promise.all([
    loadEarlierNoticeChanges(context.plan.id),
    findNoticeDay(context),
  ]);

  // A newer reading's graph replaces the one a waiting change proposes; a check that only reads
  // the date (`graph` null) keeps that graph proposed, so the learner still answers it.
  const noticeGraph = earlier.keptPlan ? null : (graph ?? earlier.waitingGraph);
  const keepsWaitingGraph = graph === null && noticeGraph !== null;
  const movesDate = day !== null && !earlier.keptDates.has(day.targetDate);

  const operations: PlanOperation[] = [
    ...(noticeGraph ? [{ kind: "followNotice" as const }] : []),
    ...(day && movesDate ? [{ kind: "setNoticeDate" as const, ...day }] : []),
  ];

  const proposed =
    operations.length > 0
      ? await proposeChange({
          approval: "always",
          context,
          notice: { graph: noticeGraph, noticeId },
          operations,
          // The notice's message says what it changes now; with the subjects a waiting change
          // proposes kept in, the app says the whole change from its operations instead.
          reason: keepsWaitingGraph ? APP_SAID_REASON : await loadNoticeMessage(noticeId),
          source: NOTICE_SOURCE,
        })
      : null;

  // A new change says everything the notice changes now, so it replaced the ones still waiting
  // (`proposeChange`); when the notice changes nothing any more, they're replaced all the same.
  // One that couldn't be made leaves them waiting.
  const changesNothing = proposed === null || proposed.status === "unchanged";

  if (earlier.waitingIds.length > 0 && changesNothing) {
    await prisma.planChange.updateMany({
      data: { status: "replaced" },
      where: { id: { in: earlier.waitingIds }, status: "proposed" },
    });

    revalidatePlanTags(context.goal.userId);
  }

  return proposed?.status === "proposed" ? "proposed" : "none";
}

/**
 * Proposes what the exam's notice changes in a goal's plan, as one change on Today that the
 * learner applies or answers with "Keep mine": the graph research's reading gave it (`graph`, when
 * the reading landed after the learner saw the plan) and the notice's exam day when it isn't the
 * goal's date. Nothing about a goal's date or structure changes without that tap. A date or a
 * notice graph the learner kept their plan over isn't proposed again. A notice change still
 * waiting is replaced by one that says everything it said that's still true: a check that only
 * reads the date keeps the graph a waiting change proposes. `noticeId` is the notice's change
 * message, which becomes the change's sentence when it says the whole change. Proposals from
 * elsewhere (the buddy's, say) stay as they are. A bridge for research and freshness workflows.
 */
export function proposeNoticeChange({
  goalId,
  graph = null,
  noticeId = null,
}: {
  goalId: string;
  graph?: PlanGraph | null;
  noticeId?: string | null;
}): Promise<NoticeChangeOutcome> {
  return withPlanRetry(() => proposeForGoal({ goalId, graph, noticeId }));
}

/**
 * A page of the active exam goals a blueprint's new or corrected notice concerns, after `after`
 * (an id), with plans to propose its date to, and where the next page starts (null after the last
 * one). `exceptGoalId` is a goal whose own research proposes it. A bridge for the workflows that
 * read notices.
 */
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
