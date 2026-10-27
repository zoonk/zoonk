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

/** Goals a check's proposals go through per step, so a popular exam never makes one long step. */
const NOTICE_GOALS_PAGE = 50;

/** Stored in `reason` when the app says the change itself, from its source and operations. */
const APP_SAID_REASON = "";

export type NoticeChangeOutcome = "none" | "proposed";

/** The notice's exam day when it isn't the goal's date (see `getNoticeDay`). */
function findNoticeDay(context: PlanContext): Promise<NoticeDay | null> {
  const { goal, state } = context;

  return loadNoticeDay({
    goal,
    goalDate: state.goal.targetDate,
    noticeDate: state.settings.noticeDate,
    today: toIsoDate(context.today),
  });
}

/**
 * The notice edition a goal's exam is on now: the hash of the document it was read from, else its
 * year; null when its exam has no stored edition. A new edition, or a corrected notice, is
 * something new, so the plan it gives is offered again once after "Keep mine".
 */
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

/**
 * The notice's changes the learner kept their own plan over, and the ones still waiting, with the
 * newest graph one of those waiting proposes (`waitingGraph`): the plan they kept over the notice's
 * subjects counts for that notice's edition only (`keptEditions`).
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
  /** Other writes that must land with the change, such as ending the plan setup task it is. */
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

  // A newer reading's graph replaces the one a waiting change proposes; a check that only reads
  // the date (`graph` null) keeps that graph proposed, so the learner still answers it. The plan
  // they kept over this edition's subjects isn't offered again.
  const noticeGraph = earlier.keptEditions.has(edition) ? null : (graph ?? earlier.waitingGraph);
  const keepsWaitingGraph = graph === null && noticeGraph !== null;

  // A day the learner kept their date over, on Today or on the understanding card that offered it,
  // isn't the notice's day to offer (see `loadNoticeDay`) until the notice says another.
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
 * Proposes what the exam's notice changes in a goal's plan, as one change on Today that the
 * learner applies or answers with "Keep mine": the graph research's reading gave it (`graph`, when
 * the reading landed after the learner saw the plan) and the notice's exam day when it isn't the
 * goal's date. Nothing about a goal's date or structure changes without that tap. A date the
 * learner kept theirs over isn't proposed again, nor the notice's subjects they kept their plan
 * over until a new edition of the notice (see `getNoticeEdition`). A notice change still
 * waiting is replaced by one that says everything it said that's still true: a check that only
 * reads the date keeps the graph a waiting change proposes. `noticeId` is the notice's change
 * message, which becomes the change's sentence when it says the whole change. Proposals from
 * elsewhere (the buddy's, say) stay as they are. A bridge for research and freshness workflows.
 */
export function proposeNoticeChange({
  graph = null,
  noticeId = null,
  ...request
}: NoticeChangeRequest): Promise<NoticeChangeOutcome> {
  return withPlanRetry(() => proposeForGoal({ ...request, graph, noticeId }));
}

/**
 * A new plan that kept the month the learner named over a notice day in another month asks about
 * that day on Today (Apply or "Keep mine"); the plan works with their month meanwhile. It's the
 * plan's `notice` setup task (see `runPlanSetupTask`): the proposal ends the task in its own
 * transaction, so it's proposed once.
 */
export async function askAboutNoticeDay(goalId: string): Promise<void> {
  const task = { goalId, task: "notice" as const };
  const outcome = await proposeNoticeChange({ extraWrites: endPlanSetupTaskWith(task), goalId });

  // Nothing proposed carried the task's end. A change applied at once did; ending it again is a no-op.
  if (outcome === "none") {
    await endPlanSetupTask(task);
  }
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
