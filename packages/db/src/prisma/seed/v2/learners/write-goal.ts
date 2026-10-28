import { type PrismaClient } from "../../../../generated/prisma/client";
import { daysFrom, localDayFrom } from "../_utils/dates";
import { Localized } from "../_utils/localize";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { seedId } from "../_utils/seed-id";
import { libraryIds } from "../library/library-ids";
import { type CourseLookup } from "./course-lookup";
import { buildPlanGraph, itemLessonKeys } from "./plan-graph";
import { type SeedGoal, type SeedLearner, type SeedPlanItem } from "./types";

const DAYS_PER_WEEK = 7;
const SUNDAY = 0;

/**
 * Saved with the plan, so the planner lays out the same plan on any database, whatever pace other
 * learners' lessons there would sample.
 */
const LESSON_PACE = { factor: 1, source: "typical" } as const;

/** Past any plan's length: items move here first, since positions are unique in a plan. */
const POSITION_OFFSET = 1_000_000;

export type LearnerScope = {
  learner: SeedLearner;
  lookup: CourseLookup;
  now: Date;
  prisma: PrismaClient;
  userId: string;
};

export function scopeDay(
  { learner, now }: Pick<LearnerScope, "learner" | "now">,
  day: number,
): Date {
  return localDayFrom({ date: now, days: day, timeZone: learner.timeZone });
}

function isoDay(scope: Pick<LearnerScope, "learner" | "now">, day: number): string {
  return scopeDay(scope, day).toISOString().slice(0, "yyyy-mm-dd".length);
}

export function planItemId(learner: SeedLearner, goal: SeedGoal, position: number): string {
  return seedId(`learner:${learner.key}:goal:${goal.key}:item:${position}`);
}

type WrittenItem = { day: number; id: string; item: SeedPlanItem; lesson?: string };

/** Weeks run Monday to Sunday, as the planner's do. */
function getWeekEnd(scope: LearnerScope): number {
  const weekday = scopeDay(scope, 0).getUTCDay();
  return weekday === SUNDAY ? 0 : DAYS_PER_WEEK - weekday;
}

function isOnPlan(item: SeedPlanItem, weekEnd: number): boolean {
  if (item.status !== "todo") {
    return true;
  }

  if (item.day !== undefined && item.day < 0) {
    throw new Error("A seeded plan item still to do can't be due before today");
  }

  return item.day !== undefined && item.day <= weekEnd;
}

function listWrittenItems(scope: LearnerScope, goal: SeedGoal): WrittenItem[] {
  const weekEnd = getWeekEnd(scope);
  const prefix = `learner:${scope.learner.key}:goal:${goal.key}:item`;

  return goal.plan.items.flatMap((item, source): WrittenItem[] => {
    if (!isOnPlan(item, weekEnd)) {
      return [];
    }

    const day = item.day ?? 0;

    if (!item.chapter || item.lesson) {
      return [{ day, id: planItemId(scope.learner, goal, source), item, lesson: item.lesson }];
    }

    return itemLessonKeys(goal.course, item).map((lesson) => ({
      day,
      id: seedId(`${prefix}:lesson:${lesson}`),
      item,
      lesson,
    }));
  });
}

function writtenContent(scope: LearnerScope, { item, lesson }: WrittenItem) {
  if (!lesson) {
    return { chapterId: null, lessonId: null, titleSnapshot: item.title ?? item.kind };
  }

  const found = scope.lookup.lesson(lesson);
  return { chapterId: found.chapterId, lessonId: found.id, titleSnapshot: found.title };
}

/** Every run plans the rest again, so the items it doesn't write go. */
async function writePlanItems(
  scope: LearnerScope,
  { goal, planId }: { goal: SeedGoal; planId: string },
): Promise<WrittenItem[]> {
  const { prisma } = scope;
  const written = listWrittenItems(scope, goal);
  const ids = written.map((entry) => entry.id);

  await prisma.planItem.deleteMany({ where: { id: { notIn: ids }, planId } });

  await prisma.planItem.updateMany({
    data: { position: { increment: POSITION_OFFSET } },
    where: { planId },
  });

  await Promise.all(
    written.map((entry, position) => {
      const { day, id, item } = entry;
      const isDone = item.status === "done" || item.status === "testedOut";

      const data = {
        ...writtenContent(scope, entry),
        completedAt: isDone ? daysFrom(scope.now, day) : null,
        kind: entry.lesson ? ("lesson" as const) : item.kind,
        lessons: null,
        phase: item.phase,
        planId,
        position,
        scheduledFor: scopeDay(scope, day),
        skillId: null,
        status: item.status,
      };

      return prisma.planItem.upsert({ create: { id, ...data }, update: data, where: { id } });
    }),
  );

  return written;
}

async function writePlanChanges(
  scope: LearnerScope,
  { goal, planId, written }: { goal: SeedGoal; planId: string; written: readonly WrittenItem[] },
) {
  const testedOut = written
    .filter((entry) => entry.item.status === "testedOut")
    .map((entry) => entry.id);

  const changes = (goal.plan.changes ?? []).map((change, index) => ({
    change,
    id: seedId(`learner:${scope.learner.key}:goal:${goal.key}:change:${index}`),
  }));

  // The persona's plan is the seed's: changes the app made to it since the last run go with it,
  // or Today keeps announcing them.
  await scope.prisma.planChange.deleteMany({
    where: { id: { notIn: changes.map((entry) => entry.id) }, planId },
  });

  await Promise.all(
    changes.map(({ change, id }) => {
      const data = {
        createdAt: daysFrom(scope.now, change.day),
        kind: change.kind,
        payload:
          change.kind === "testedOut"
            ? { ...change.payload, planItemIds: testedOut }
            : change.payload,
        planId,
        reason:
          change.reason instanceof Localized
            ? change.reason.in(scope.learner.language)
            : change.reason,
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

  const planData = {
    estimateHours: null,
    goalId,
    graph: buildPlanGraph(scope, goal),
    phases: [],
    settings: {
      examChoices: (goal.plan.examChoices ?? []).map((choice) => ({
        group: choice.group.in(learner.language),
        subject: choice.subject.in(learner.language),
      })),
      focusAreas: goal.plan.focusAreas ?? [],
      pace: LESSON_PACE,
      startDate: isoDay(scope, goal.createdDay),
    },
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

  const written = await writePlanItems(scope, { goal, planId });
  await writePlanChanges(scope, { goal, planId, written });

  return goalId;
}
