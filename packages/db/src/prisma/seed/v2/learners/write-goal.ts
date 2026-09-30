import { MS_PER_DAY } from "@zoonk/utils/date";
import { type PrismaClient } from "../../../../generated/prisma/client";
import { daysFrom, localDayFrom } from "../_utils/dates";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { seedId } from "../_utils/seed-id";
import { libraryIds } from "../library/library-ids";
import { type CourseLookup } from "./course-lookup";
import { buildPlanGraph } from "./plan-graph";
import { type ScheduledItem, type ScheduledPhase, schedulePlan } from "./plan-schedule";
import { type SeedGoal, type SeedLearner } from "./types";

const MINUTES_PER_HOUR = 60;

export type LearnerScope = {
  learner: SeedLearner;
  lookup: CourseLookup;
  now: Date;
  prisma: PrismaClient;
  userId: string;
};

/** The learner-local calendar day `day` days from today, as `@db.Date` columns store it. */
export function scopeDay(
  { learner, now }: Pick<LearnerScope, "learner" | "now">,
  day: number,
): Date {
  return localDayFrom({ date: now, days: day, timeZone: learner.timeZone });
}

function isoDay(scope: Pick<LearnerScope, "learner" | "now">, day: number): string {
  return scopeDay(scope, day).toISOString().slice(0, "yyyy-mm-dd".length);
}

/** The stable id of the persona's plan item at one position of its `plan.items`. */
export function planItemId(learner: SeedLearner, goal: SeedGoal, position: number): string {
  return seedId(`learner:${learner.key}:goal:${goal.key}:item:${position}`);
}

/** A persona's item keeps its id; items the schedule planned are known by their planner key. */
function scheduledItemId(scope: LearnerScope, goal: SeedGoal, item: ScheduledItem): string {
  return item.source === undefined
    ? seedId(`learner:${scope.learner.key}:goal:${goal.key}:item:${item.key}`)
    : planItemId(scope.learner, goal, item.source);
}

function planItemContent(scope: LearnerScope, item: ScheduledItem) {
  const { lookup } = scope;

  if (item.lesson) {
    const lesson = lookup.lesson(item.lesson);

    return {
      chapterId: lesson.chapterId,
      lessonId: lesson.id,
      skillId: null,
      titleSnapshot: lesson.title,
    };
  }

  // A stand-in for lessons the Library hasn't outlined yet is known by its skill.
  if (item.skill) {
    return {
      chapterId: null,
      lessonId: null,
      skillId: lookup.skill(item.skill),
      titleSnapshot: lookup.skillName(item.skill),
    };
  }

  return { chapterId: null, lessonId: null, skillId: null, titleSnapshot: item.title ?? item.kind };
}

/**
 * An exam's items as the persona wrote them: the exam planner's windows, mocks and reviews aren't
 * planned by the seed.
 */
function listExamItems(goal: SeedGoal): ScheduledItem[] {
  return goal.plan.items.map((item, source) => ({
    chapter: item.chapter,
    day: item.day ?? 0,
    key: `item:${source}`,
    kind: item.kind,
    lesson: item.lesson,
    minutes: 0,
    phase: item.phase,
    source,
    status: item.status,
    title: item.title,
  }));
}

/** Past any plan's length: existing items move here first, so no two ever share a position. */
const POSITION_OFFSET = 1_000_000;

function chapterContent(scope: LearnerScope, item: ScheduledItem) {
  const chapter = scope.lookup.chapter(item.chapter ?? "");

  return {
    chapterId: chapter.id,
    lessonId: null,
    skillId: null,
    titleSnapshot: item.title ?? chapter.title,
  };
}

/**
 * Writes the plan's items in order. A run on another day plans other items, so the ones it no
 * longer has go, and the rest step aside before taking their new positions.
 */
async function writePlanItems(
  scope: LearnerScope,
  { goal, items, planId }: { goal: SeedGoal; items: readonly ScheduledItem[]; planId: string },
) {
  const { prisma } = scope;
  const ids = items.map((item) => scheduledItemId(scope, goal, item));

  await prisma.planItem.deleteMany({ where: { id: { notIn: ids }, planId } });

  await prisma.planItem.updateMany({
    data: { position: { increment: POSITION_OFFSET } },
    where: { planId },
  });

  await Promise.all(
    items.map((item, position) => {
      const id = ids[position] ?? "";
      const isDone = item.status === "done" || item.status === "testedOut";

      const content =
        item.chapter && !item.lesson ? chapterContent(scope, item) : planItemContent(scope, item);

      const data = {
        ...content,
        completedAt: isDone ? daysFrom(scope.now, item.day) : null,
        kind: item.kind,
        phase: item.phase,
        planId,
        position,
        scheduledFor: scopeDay(scope, item.day),
        status: item.status,
      };

      return prisma.planItem.upsert({ create: { id, ...data }, update: data, where: { id } });
    }),
  );

  return ids;
}

async function writePlanChanges(
  scope: LearnerScope,
  {
    goal,
    itemIds,
    items,
    planId,
  }: {
    goal: SeedGoal;
    itemIds: readonly string[];
    items: readonly ScheduledItem[];
    planId: string;
  },
) {
  const testedOut = itemIds.filter((_, index) => items[index]?.status === "testedOut");

  await Promise.all(
    (goal.plan.changes ?? []).map((change, index) => {
      const id = seedId(`learner:${scope.learner.key}:goal:${goal.key}:change:${index}`);

      const data = {
        createdAt: daysFrom(scope.now, change.day),
        kind: change.kind,
        payload:
          change.kind === "testedOut"
            ? { ...change.payload, planItemIds: testedOut }
            : change.payload,
        planId,
        reason: change.reason,
        status: change.status ?? "applied",
        ...SEED_PROVENANCE,
      };

      return scope.prisma.planChange.upsert({
        create: { id, ...data },
        update: data,
        where: { id },
      });
    }),
  );
}

/** An exam's phases are its windows, each as long as its days at the goal's daily minutes. */
function listExamPhases(goal: SeedGoal): ScheduledPhase[] {
  return goal.plan.phases.map((phase) => {
    const startDay = phase.startDay ?? 0;
    const endDay = phase.endDay ?? startDay;

    return {
      endDay,
      milestone: phase.milestone ?? null,
      minutes: (endDay - startDay + 1) * goal.dailyMinutes,
      name: phase.name,
      startDay,
    };
  });
}

/**
 * The plan as the app plans it: from its skill graph outside exams (see `schedulePlan`), and for
 * an exam, the persona's items in its windows.
 */
function planGoal(scope: LearnerScope, goal: SeedGoal) {
  if (goal.kind === "exam") {
    const phases = listExamPhases(goal);
    const minutes = phases.reduce((total, phase) => total + phase.minutes, 0);
    return { items: listExamItems(goal), phases, totalMinutes: minutes };
  }

  const today = scopeDay(scope, 0);

  // The plan reads a target date by its calendar day, as the goal's date column keeps it.
  const targetDay = goal.targetDate
    ? Math.round(
        (new Date(goal.targetDate.toISOString().slice(0, "yyyy-mm-dd".length)).getTime() -
          today.getTime()) /
          MS_PER_DAY,
      )
    : null;

  return schedulePlan({ goal, targetDay, todayWeekday: today.getUTCDay() });
}

/**
 * Writes a goal with its plan: phases with dates, ordered items pointing at the course's lessons
 * and chapters, and plan changes with their reasons.
 */
export async function writeGoal(scope: LearnerScope, goal: SeedGoal): Promise<string> {
  const { learner, lookup, now, prisma, userId } = scope;
  const goalId = seedId(`learner:${learner.key}:goal:${goal.key}`);
  const planId = seedId(`learner:${learner.key}:goal:${goal.key}:plan`);

  const goalData = {
    createdAt: daysFrom(now, goal.createdDay),
    dailyMinutes: goal.dailyMinutes,
    details: goal.details,
    examBlueprintId: goal.exam ? libraryIds.blueprint(goal.exam, learner.language) : null,
    kind: goal.kind,
    language: learner.language,
    primaryCourseId: lookup.courseId,
    prompt: goal.prompt,
    status: goal.status ?? "active",
    studyTime: goal.studyTime,
    targetDate: goal.targetDate ?? null,
    targetLanguage: goal.course.targetLanguage ?? null,
    timezone: learner.timeZone,
    title: goal.title,
    userId,
  };

  const planned = planGoal(scope, goal);

  const phases = planned.phases.map((phase, index) => ({
    endDate: phase.endDay === null ? null : isoDay(scope, phase.endDay),
    kind: goal.plan.phases[index]?.kind ?? "learn",
    milestone: phase.milestone,
    minutes: phase.minutes,
    name: phase.name,
    startDate: phase.startDay === null ? null : isoDay(scope, phase.startDay),
  }));

  const planData = {
    estimateHours: planned.totalMinutes / MINUTES_PER_HOUR,
    goalId,
    graph: buildPlanGraph(scope, goal),
    phases,
    settings: { focusAreas: goal.plan.focusAreas ?? [], startDate: isoDay(scope, goal.createdDay) },
    ...SEED_PROVENANCE,
    generatedAt: daysFrom(now, goal.createdDay),
  };

  await prisma.goal.upsert({
    create: { id: goalId, ...goalData },
    update: goalData,
    where: { id: goalId },
  });

  await prisma.plan.upsert({
    create: { id: planId, ...planData },
    update: planData,
    where: { id: planId },
  });

  const itemIds = await writePlanItems(scope, { goal, items: planned.items, planId });
  await writePlanChanges(scope, { goal, itemIds, items: planned.items, planId });

  return goalId;
}
