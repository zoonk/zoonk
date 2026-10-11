import {
  type Goal,
  type Plan,
  type PlanChange,
  type PlanItem,
  type SuggestedGoal,
  prisma,
} from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

const DEFAULT_DAILY_MINUTES = 20;

/** Creates an active learn goal for a learner. */
export async function goalFixture(attrs: FixtureAttrs<Goal, "details"> & Pick<Goal, "userId">) {
  return prisma.goal.create({
    data: {
      dailyMinutes: DEFAULT_DAILY_MINUTES,
      kind: "learn",
      language: "en",
      prompt: "I want to learn test subjects",
      title: "Learn test subjects",
      ...attrs,
    },
  });
}

/** Creates the plan of a goal with one phase. */
export async function planFixture(
  attrs: FixtureAttrs<Plan, "graph" | "phases" | "settings"> & Pick<Plan, "goalId">,
) {
  return prisma.plan.create({
    data: { phases: [{ name: "Test phase", summary: "Test phase summary" }], ...attrs },
  });
}

/**
 * Creates a plan item. Without a position it goes after the plan's current items; tests that add
 * several items in parallel should pass positions.
 */
export async function planItemFixture(attrs: FixtureAttrs<PlanItem> & Pick<PlanItem, "planId">) {
  const position =
    attrs.position ?? (await prisma.planItem.count({ where: { planId: attrs.planId } }));

  return prisma.planItem.create({
    data: { kind: "lesson", phase: 0, titleSnapshot: "Test plan item", ...attrs, position },
  });
}

const UNDOABLE_KINDS = new Set(["edited", "testedOut"]);

function toIsoDay(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** The plan as it is now, as core's `PlanSnapshot` keeps it for an undo. */
async function snapshotPlan(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { goal: true, items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  return {
    coveredShare: plan.coveredShare,
    estimateHours: plan.estimateHours,
    items: plan.items.map((item) => ({
      chapterId: item.chapterId,
      completedAt: item.completedAt?.toISOString() ?? null,
      id: item.id,
      kind: item.kind,
      lessonId: item.lessonId,
      lessons: item.lessons,
      phase: item.phase,
      scheduledFor: toIsoDay(item.scheduledFor),
      skillId: item.skillId,
      status: item.status,
      titleSnapshot: item.titleSnapshot,
    })),
    phases: plan.phases,
    state: {
      goal: { dailyMinutes: plan.goal.dailyMinutes, targetDate: toIsoDay(plan.goal.targetDate) },
      graph: plan.graph,
      settings: plan.settings,
    },
  };
}

/**
 * Records a plan change with its one-sentence reason. An applied edit or test-out keeps the plan
 * as it is now, which its undo puts back, as the planner records one.
 */
export async function planChangeFixture(
  attrs: FixtureAttrs<PlanChange, "payload"> & Pick<PlanChange, "planId">,
) {
  const change = await prisma.planChange.create({
    data: { kind: "addLesson", reason: "Test reason for the change", ...attrs },
  });

  if (UNDOABLE_KINDS.has(change.kind) && change.status === "applied") {
    await prisma.planChangeSnapshot.create({
      data: { changeId: change.id, plan: await snapshotPlan(change.planId) },
    });
  }

  return change;
}

/** Offers a course a learner was taking before goals existed as a goal to plan. */
export async function suggestedGoalFixture(
  attrs: FixtureAttrs<SuggestedGoal> & Pick<SuggestedGoal, "userId">,
) {
  return prisma.suggestedGoal.create({
    data: { courseId: crypto.randomUUID(), lastActiveAt: new Date(), title: "Physics", ...attrs },
  });
}
