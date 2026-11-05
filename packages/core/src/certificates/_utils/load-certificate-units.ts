import "server-only";
import { type Goal, type Plan, type PlanItem, type TransactionClient, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { LEARN_KINDS, isStandIn } from "../../plans/planner/plan-item-rules";
import { parsePlanGraph, parsePlanPhases, parsePlanSettings } from "../../plans/planner/plan-state";
import { type CertifiableItem, listCertificateUnits } from "./certificate-units";

export type UnitGoal = Pick<Goal, "id" | "kind" | "primaryCourseId" | "targetDate" | "userId">;

export type UnitPlan = Pick<Plan, "createdAt" | "graph" | "phases" | "settings"> & {
  items: readonly Pick<
    PlanItem,
    | "chapterId"
    | "completedAt"
    | "kind"
    | "lessonId"
    | "lessons"
    | "minutes"
    | "phase"
    | "skillId"
    | "status"
  >[];
};

export const UNIT_PLAN_SELECT = {
  createdAt: true,
  graph: true,
  items: {
    orderBy: { position: "asc" },
    select: {
      chapterId: true,
      completedAt: true,
      kind: true,
      lessonId: true,
      lessons: true,
      minutes: true,
      phase: true,
      skillId: true,
      status: true,
    },
  },
  phases: true,
  settings: true,
} as const;

/** A level counts only the chapters this learner can see, so another learner's private chapter in a shared level never blocks it. */
async function loadPrimaryCourse(db: TransactionClient, goal: UnitGoal) {
  if (!goal.primaryCourseId) {
    return null;
  }

  return db.course.findUnique({
    select: {
      categories: { orderBy: { createdAt: "asc" }, select: { category: true }, take: 1 },
      courseChapters: {
        select: { chapterId: true, createdAt: true, level: true },
        where: { chapter: libraryRowsVisibleTo(goal.userId) },
      },
      format: true,
      title: true,
      visibility: true,
    },
    where: { id: goal.primaryCourseId },
  });
}

export type UnitCourse = NonNullable<Awaited<ReturnType<typeof loadPrimaryCourse>>>;

async function loadHomeChapters(db: TransactionClient, plan: UnitPlan) {
  const lessonIds = plan.items.flatMap((item) =>
    LEARN_KINDS.has(item.kind) && !item.chapterId && item.lessonId ? item.lessonId : [],
  );

  if (lessonIds.length === 0) {
    return new Map<string, string | null>();
  }

  const lessons = await db.lesson.findMany({
    select: { homeChapterId: true, id: true },
    where: { id: { in: lessonIds } },
  });

  return new Map(lessons.map((lesson) => [lesson.id, lesson.homeChapterId]));
}

/** A stand-in counts in the primary course's level of its skill unless the plan's graph gives the skill to another course. */
async function loadStandInLevels(db: TransactionClient, { goal, plan }: UnitInput) {
  const courses = new Map(
    parsePlanGraph(plan.graph).skills.map((skill) => [skill.skillId, skill.courseIds?.[0]]),
  );

  const skillIds = plan.items.flatMap((item) =>
    isStandIn(item) &&
    item.skillId &&
    (courses.get(item.skillId) ?? goal.primaryCourseId) === goal.primaryCourseId
      ? item.skillId
      : [],
  );

  if (!goal.primaryCourseId || skillIds.length === 0) {
    return new Map<string, CertifiableItem["level"]>();
  }

  const skills = await db.skill.findMany({
    select: { id: true, level: true },
    where: { id: { in: skillIds } },
  });

  return new Map(skills.map((skill) => [skill.id, skill.level]));
}

/**
 * Of the chapters a level of the plan had when it began and the plan holds no item in, the ones
 * whose lessons teach only skills the plan's graph has. A chapter without lessons yet teaches
 * nothing the plan could miss.
 */
async function findChaptersTaughtInPlan(
  db: TransactionClient,
  {
    course,
    goal,
    items,
    plan,
  }: UnitInput & { course: UnitCourse | null; items: readonly CertifiableItem[] },
): Promise<Set<string>> {
  const held = new Set(items.flatMap((item) => item.chapterId ?? []));
  const levels = new Set(items.flatMap((item) => item.level ?? []));

  const missing =
    course?.courseChapters.flatMap((entry) =>
      held.has(entry.chapterId) || !levels.has(entry.level) || entry.createdAt > plan.createdAt
        ? []
        : entry.chapterId,
    ) ?? [];

  if (missing.length === 0) {
    return new Set();
  }

  const visible = libraryRowsVisibleTo(goal.userId);
  const planned = new Set(parsePlanGraph(plan.graph).skills.map((skill) => skill.skillId));

  const chapters = await db.chapter.findMany({
    select: {
      id: true,
      lessons: {
        select: {
          lesson: { select: { skills: { select: { skillId: true }, where: { skill: visible } } } },
        },
        where: { lesson: { ...visible, setAsideAt: null } },
      },
    },
    where: { id: { in: missing } },
  });

  return new Set(
    chapters.flatMap((chapter) =>
      chapter.lessons.every(({ lesson }) =>
        lesson.skills.every((skill) => planned.has(skill.skillId)),
      )
        ? chapter.id
        : [],
    ),
  );
}

function loadHeldCertificates(db: TransactionClient, goal: UnitGoal) {
  return db.certificate.findMany({
    select: { code: true, issuedAt: true, key: true },
    where: {
      OR: [
        { key: goal.id },
        ...(goal.primaryCourseId ? [{ key: { startsWith: `${goal.primaryCourseId}:` } }] : []),
      ],
      kind: "course",
      userId: goal.userId,
    },
  });
}

type UnitInput = { goal: UnitGoal; plan: UnitPlan };

/** The plan's level and plan certificates, finished or not, with the ones the learner holds. */
export async function loadCertificateUnits(
  { goal, plan }: UnitInput,
  db: TransactionClient = prisma,
) {
  const [course, homeChapters, standInLevels, held] = await Promise.all([
    loadPrimaryCourse(db, goal),
    loadHomeChapters(db, plan),
    loadStandInLevels(db, { goal, plan }),
    loadHeldCertificates(db, goal),
  ]);

  const levels = new Map(course?.courseChapters.map((entry) => [entry.chapterId, entry.level]));

  const items = plan.items.map((item): CertifiableItem => {
    if (!LEARN_KINDS.has(item.kind)) {
      return { ...item, chapterId: null, level: null };
    }

    const chapterId =
      item.chapterId ?? (item.lessonId ? homeChapters.get(item.lessonId) : null) ?? null;

    const level = chapterId
      ? (levels.get(chapterId) ?? null)
      : (standInLevels.get(item.skillId ?? "") ?? null);

    return { ...item, chapterId, level };
  });

  const taught = await findChaptersTaughtInPlan(db, { course, goal, items, plan });

  const units = listCertificateUnits({
    goal,
    heldKeys: new Set(held.map((row) => row.key)),
    items,
    levelChapters:
      course?.courseChapters.map((entry) => ({
        ...entry,
        taughtInPlan: taught.has(entry.chapterId),
      })) ?? [],
    levelCourseId:
      course?.visibility === "public" && course.format === "core" ? goal.primaryCourseId : null,
    phases: parsePlanPhases(plan.phases),
    planCreatedAt: plan.createdAt,
    studiesPastTarget: goal.kind === "exam" && parsePlanSettings(plan.settings).fullCourse,
  });

  const unitKeys = new Set(units.map((unit) => unit.key));

  return { course, held: held.filter((row) => unitKeys.has(row.key)), units };
}
