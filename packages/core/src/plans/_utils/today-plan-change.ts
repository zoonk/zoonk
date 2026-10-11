import "server-only";
import { type Goal, type PlanChange, prisma } from "@zoonk/db";
import { OWN_LEVEL_SOURCE } from "../own-level-contract";
import { type PlanChangeView } from "../plan-view-contract";
import { parsePlanGraph } from "../planner/plan-state";
import { isPlanReady } from "./apply-plan-change";
import { getBehindChoices } from "./falling-behind";
import { foldChangeAreas } from "./fold-part-areas";
import { loadGraphPartAreas } from "./part-areas";
import { parsePlanChangePayload } from "./plan-change-payload";
import { changeGoalSelect, toPlanChangeView } from "./plan-change-view";
import { loadPlanContext } from "./plan-context";
import { computePlan } from "./replan";

/** An automatic change is news for a day; after that it's simply how the plan is. */
const RECENT_CHANGE_MS = 24 * 60 * 60 * 1000;

/** Changes the learner made on purpose (in the plan editor, in words, or their own level). */
const LEARNER_SOURCES: ReadonlySet<string> = new Set(["learner", "planEdit", OWN_LEVEL_SOURCE]);

/** A sharper estimate and a resumed goal say nothing the learner needs to answer. */
const QUIET_KINDS: ReadonlySet<string> = new Set(["estimateUpdated", "resumed"]);

/**
 * The plan change Today shows: a proposal waiting for an OK, or an automatic change of the last
 * day (a rebalance, falling behind, a test-out). A test-out names its chapter when every lesson it
 * skipped is from one.
 */
export type TodayPlanChangeView = PlanChangeView & { chapterTitle: string | null };

/**
 * Lessons earlier days left coming first is what Today's list already shows; it's news only when
 * falling behind puts the date at risk, and the learner chooses what to do about it, or when it
 * moves topics in or out of the plan, which Today names. A quiet kind (a sharper estimate, a goal
 * back from a pause) is news only then too.
 */
function isAutomatic(change: PlanChange): boolean {
  const { behind, effect, source } = parsePlanChangePayload(change.payload);
  const movesTopics = (effect?.topicsLeftOut?.length ?? 0) + (effect?.topicsAdded?.length ?? 0) > 0;

  return (
    !LEARNER_SOURCES.has(source) &&
    (movesTopics ||
      (!QUIET_KINDS.has(change.kind) && (change.kind !== "missedDays" || behind !== null)))
  );
}

/** The chapter a test-out skipped lessons of, when they all come from the same one. */
async function loadSkippedChapterTitle({
  kind,
  planItemIds,
}: {
  kind: string;
  planItemIds: string[];
}): Promise<string | null> {
  if (kind !== "testedOut" || planItemIds.length === 0) {
    return null;
  }

  const items = await prisma.planItem.findMany({
    select: { chapter: { select: { title: true } }, chapterId: true },
    where: { id: { in: planItemIds } },
  });

  const [first] = items;
  const oneChapter = new Set(items.map((item) => item.chapterId)).size === 1;

  return oneChapter && first?.chapter ? first.chapter.title : null;
}

/** The newest proposal waiting for an OK, else the newest unseen automatic change of the last day. */
async function findTodayChange({ now, planId }: { now: Date; planId: string }) {
  const [proposal, recent] = await Promise.all([
    prisma.planChange.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: { planId, status: "proposed" },
    }),
    prisma.planChange.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: {
        createdAt: { gte: new Date(now.getTime() - RECENT_CHANGE_MS) },
        planId,
        status: "applied",
      },
    }),
  ]);

  return (
    proposal ??
    recent.find(
      (change) => isAutomatic(change) && parsePlanChangePayload(change.payload).seenAt === null,
    ) ??
    null
  );
}

type Behind = NonNullable<PlanChangeView["behind"]>;

/**
 * Falling behind's choices as the plan offers them now, as the Journey reads them: the plan can
 * move after the day's settle (lessons written, a session ended), and Rafaela's card said "about
 * 54%" beside her Journey's "about 55%". What the missed days did (covered before and after)
 * stays the settle's.
 */
async function loadCurrentBehind({
  behind,
  goal,
  now,
  timeZone,
}: {
  behind: Behind;
  goal: Goal;
  now: Date;
  timeZone?: string | null;
}): Promise<Behind> {
  const context = await loadPlanContext({ goal, now, timeZone });

  if (!context || context.phases.length === 0 || !isPlanReady(context)) {
    return behind;
  }

  const computed = await computePlan({ context, mode: "automatic", now, pace: "saved" });

  return { ...behind, ...getBehindChoices(computed) };
}

/**
 * The one plan change Today carries, so the learner can answer it where they are: OK or not now
 * for a proposal, and "Got it" (or an undo, while the plan is still as the change left it) for an
 * automatic change. Null when there's nothing to say.
 */
export async function loadTodayPlanChange({
  goal,
  now,
  timeZone,
}: {
  goal: Goal;
  now: Date;
  timeZone?: string | null;
}): Promise<TodayPlanChangeView | null> {
  const goalId = goal.id;

  const plan = await prisma.plan.findUnique({
    select: {
      goal: { select: { ...changeGoalSelect, examBlueprintId: true } },
      graph: true,
      id: true,
      version: true,
    },
    where: { goalId },
  });

  const change = plan ? await findTodayChange({ now, planId: plan.id }) : null;

  if (!plan || !change) {
    return null;
  }

  const { behind, planItemIds } = parsePlanChangePayload(change.payload);

  const [chapterTitle, partAreas, currentBehind] = await Promise.all([
    loadSkippedChapterTitle({ kind: change.kind, planItemIds }),
    loadGraphPartAreas({
      examBlueprintId: plan.goal.examBlueprintId,
      graph: parsePlanGraph(plan.graph),
    }),
    behind ? loadCurrentBehind({ behind, goal, now, timeZone }) : null,
  ]);

  const view = toPlanChangeView({ change, goal: plan.goal, planVersion: plan.version });

  return {
    ...foldChangeAreas({ change: { ...view, behind: currentBehind }, partAreas }),
    chapterTitle,
  };
}
