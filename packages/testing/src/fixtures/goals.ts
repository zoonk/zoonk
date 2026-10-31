import {
  type Goal,
  type Plan,
  type PlanChange,
  type PlanItem,
  type SuggestedGoal,
  prisma,
} from "@zoonk/db";
import { toUTCMidnight } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { type FixtureAttrs } from "./_utils/fixture-attrs";
import { lessonSkillFixture } from "./library-lessons";
import { skillFixture } from "./skills";

const DEFAULT_DAILY_MINUTES = 20;

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

type PlanAttrs = FixtureAttrs<Plan, "graph" | "phases" | "settings" | "summary"> &
  Pick<Plan, "goalId">;

type PlanItemAttrs = Omit<Parameters<typeof planItemFixture>[0], "planId">;

async function withLessonSkill(item: PlanItemAttrs): Promise<PlanItemAttrs> {
  if (item.skillId || !item.lessonId) {
    return item;
  }

  const linked = await prisma.lessonSkill.findFirst({ where: { lessonId: item.lessonId } });

  if (linked) {
    return { ...item, skillId: linked.skillId };
  }

  const skill = await skillFixture();
  await lessonSkillFixture({ lessonId: item.lessonId, skillId: skill.id });
  return { ...item, skillId: skill.id };
}

export async function planFixture(
  attrs: PlanAttrs & { items: PlanItemAttrs[] },
): Promise<Plan & { items: PlanItem[] }>;
export async function planFixture(attrs: PlanAttrs): Promise<Plan>;
export async function planFixture({ items, ...attrs }: PlanAttrs & { items?: PlanItemAttrs[] }) {
  const plan = await prisma.plan.create({
    data: { phases: [{ name: "Test phase", summary: "Test phase summary" }], ...attrs },
  });

  if (!items) {
    return plan;
  }

  const created = await Promise.all(
    items.map(async (item, position) =>
      planItemFixture({ position, ...(await withLessonSkill(item)), planId: plan.id }),
    ),
  );

  const laidOut = await layOutPlanFixture(plan.id);
  return { ...laidOut.plan, items: created };
}

/** Tests that add several items in parallel should pass positions. */
export async function planItemFixture(
  attrs: FixtureAttrs<PlanItem, "facts"> & Pick<PlanItem, "planId">,
) {
  const position =
    attrs.position ?? (await prisma.planItem.count({ where: { planId: attrs.planId } }));

  return prisma.planItem.create({
    data: { kind: "lesson", phase: 0, titleSnapshot: "Test plan item", ...attrs, position },
  });
}

const LEARN_KINDS = new Set<string>(["chapter", "lesson"]);

type StoredPhase = { kind?: string; name?: string; startDate?: string | null };

function isStoredPhase(value: unknown): value is StoredPhase {
  return typeof value === "object" && value !== null;
}

export function plannedSkills(
  skills: readonly { id: string; lessons?: number; name: string; phase?: number }[],
) {
  return skills.map((skill) => ({
    area: null,
    lessons: skill.lessons ?? 1,
    name: skill.name,
    phase: skill.phase ?? 0,
    skillId: skill.id,
    weight: null,
  }));
}

function graphFromItems({
  graph,
  items,
  phases,
}: {
  graph: Record<string, unknown>;
  items: { phase: number; skill: { id: string; name: string } | null }[];
  phases: readonly StoredPhase[];
}) {
  const taught = Map.groupBy(
    items.flatMap((item) => (item.skill ? [{ ...item.skill, phase: item.phase }] : [])),
    (skill) => skill.id,
  );

  const stored = (Array.isArray(graph.skills) ? graph.skills : []).filter((skill) =>
    isJsonObject(skill),
  );

  const storedIds = new Set(stored.map((skill) => skill.skillId));

  const added = [...taught.values()].flatMap(([skill, ...rest]) =>
    skill && !storedIds.has(skill.id) ? [{ ...skill, lessons: rest.length + 1 }] : [],
  );

  const skills = stored.map((skill) => {
    const [item] = typeof skill.skillId === "string" ? (taught.get(skill.skillId) ?? []) : [];
    return item ? { ...skill, phase: item.phase } : skill;
  });

  const phaseCount = Math.max(phases.length, ...items.map((item) => item.phase + 1));

  const named = Array.from({ length: phaseCount }, (_, index) => ({
    milestone: null,
    name: phases[index]?.name || `Phase ${index + 1}`,
  }));

  const graphPhases = Array.isArray(graph.phases) && graph.phases.length > 0 ? graph.phases : named;
  return { ...graph, phases: graphPhases, skills: [...skills, ...plannedSkills(added)] };
}

function datePhases(value: unknown) {
  const phases = Array.isArray(value) ? value.filter((phase) => isStoredPhase(phase)) : [];
  const startDate = toIsoDay(toUTCMidnight(new Date()));

  if (phases.some((phase) => phase.startDate)) {
    return phases;
  }

  const [first = { name: "Test phase" }, ...rest] = phases;
  return [{ ...first, startDate }, ...rest];
}

function placeChallenges({
  items,
  open,
}: {
  items: readonly { id: string; phase: number; position: number }[];
  open: readonly number[];
}) {
  const closing = new Map(
    open.map((phase) => [items.findLast((item) => item.phase <= phase)?.id, phase]),
  );

  const placed = items.map((item, index) => {
    const shift = items.slice(0, index).filter((earlier) => closing.has(earlier.id)).length;
    return { ...item, position: item.position + shift };
  });

  return {
    bosses: placed.flatMap((item) => {
      const phase = closing.get(item.id);
      return phase === undefined ? [] : [{ phase, position: item.position + 1 }];
    }),
    moved: placed.filter((item, index) => item.position !== items[index]?.position),
  };
}

/**
 * A read re-plans a plan the planner didn't lay out, so call this once the test's items are final.
 */
export async function layOutPlanFixture(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: { include: { skill: true }, orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  const phases = datePhases(plan.phases);

  const lessons = plan.items.filter(
    (item) => LEARN_KINDS.has(item.kind) && item.status !== "skipped",
  );

  const closed = new Set(plan.items.flatMap((item) => (item.kind === "boss" ? [item.phase] : [])));

  const open = [...new Set(lessons.map((item) => item.phase))].filter(
    (phase) => !closed.has(phase) && phases[phase]?.kind !== "afterExam",
  );

  const { bosses, moved } = placeChallenges({ items: plan.items, open });
  const graph = isJsonObject(plan.graph) ? plan.graph : {};

  // Positions are unique in a plan, so moved items step aside before taking their new place.
  const laidOut = await prisma.$transaction(async (tx) => {
    await Promise.all(
      moved.map((item) =>
        tx.planItem.update({ data: { position: -1 - item.position }, where: { id: item.id } }),
      ),
    );

    await Promise.all(
      moved.map((item) =>
        tx.planItem.update({ data: { position: item.position }, where: { id: item.id } }),
      ),
    );

    return tx.plan.update({
      data: { graph: graphFromItems({ graph, items: lessons, phases }), phases },
      where: { id: planId },
    });
  });

  const added = await Promise.all(
    bosses.map((boss) =>
      planItemFixture({ ...boss, kind: "boss", planId, titleSnapshot: "Test challenge" }),
    ),
  );

  return { bosses: added, plan: laidOut };
}

const UNDOABLE_KINDS = new Set(["edited", "testedOut"]);

function toIsoDay(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

async function snapshotPlan(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { goal: true, items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  return {
    coveredShare: plan.coveredShare,
    estimateHours: plan.estimateHours,
    inputsKey: plan.inputsKey,
    items: plan.items.map((item) => ({
      chapterId: item.chapterId,
      completedAt: item.completedAt?.toISOString() ?? null,
      facts: item.facts,
      id: item.id,
      kind: item.kind,
      lessonId: item.lessonId,
      lessons: item.lessons,
      minutes: item.minutes,
      phase: item.phase,
      scheduledFor: toIsoDay(item.scheduledFor),
      skillId: item.skillId,
      status: item.status,
      titleSnapshot: item.titleSnapshot,
    })),
    phases: plan.phases,
    sourceSkillIds: plan.sourceSkillIds,
    state: {
      goal: { dailyMinutes: plan.goal.dailyMinutes, targetDate: toIsoDay(plan.goal.targetDate) },
      graph: plan.graph,
      settings: plan.settings,
    },
    summary: plan.summary,
    todaySession: null,
  };
}

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

export async function suggestedGoalFixture(
  attrs: FixtureAttrs<SuggestedGoal> & Pick<SuggestedGoal, "userId">,
) {
  return prisma.suggestedGoal.create({
    data: { courseId: crypto.randomUUID(), lastActiveAt: new Date(), title: "Physics", ...attrs },
  });
}
