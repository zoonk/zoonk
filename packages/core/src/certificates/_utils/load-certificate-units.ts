import "server-only";
import {
  type CourseLevel,
  type Goal,
  type Plan,
  type PlanItem,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { type PlanScope } from "../../plans/_utils/half-studied";
import { loadPlanScope } from "../../plans/_utils/plan-scope";
import { isWorkFinished } from "../../plans/_utils/work-progress";
import { LEARN_KINDS, isStandIn } from "../../plans/planner/plan-item-rules";
import { parsePlanGraph, parsePlanPhases, parsePlanSettings } from "../../plans/planner/plan-state";
import {
  type CertifiableItem,
  type CertificateUnit,
  listCertificateUnits,
} from "./certificate-units";

export type UnitGoal = Pick<
  Goal,
  "details" | "examBlueprintId" | "id" | "kind" | "primaryCourseId" | "targetDate" | "userId"
>;

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

type UnitCourse = NonNullable<Awaited<ReturnType<typeof loadPrimaryCourse>>>;

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

/**
 * A graph skill or a stand-in counts in the primary course's level of its skill unless the plan's
 * graph gives the skill to another course.
 */
async function loadSkillLevels(
  db: TransactionClient,
  { goal, plan, scope }: UnitInput & { scope: PlanScope },
): Promise<Map<string, CourseLevel>> {
  const courses = new Map([
    ...parsePlanGraph(plan.graph).skills.map(
      (skill) => [skill.skillId, skill.courseIds?.[0]] as const,
    ),
    ...scope.keptSkills.map((skill) => [skill.skillId, skill.courseIds?.[0]] as const),
  ]);

  const skillIds = [
    ...scope.keptSkills.map((skill) => skill.skillId),
    ...plan.items.flatMap((item) => (isStandIn(item) && item.skillId ? item.skillId : [])),
  ].filter((skillId) => (courses.get(skillId) ?? goal.primaryCourseId) === goal.primaryCourseId);

  if (!goal.primaryCourseId || skillIds.length === 0) {
    return new Map();
  }

  const skills = await db.skill.findMany({
    select: { id: true, level: true },
    where: { id: { in: [...new Set(skillIds)] } },
  });

  return new Map(
    skills.flatMap((skill) => (skill.level ? [[skill.id, skill.level] as const] : [])),
  );
}

/**
 * Of the chapters a level of the plan had when it began and the plan holds no item in, the ones
 * whose lessons teach only skills the plan's finished lessons taught. Not the plan's graph: an area
 * the learner skipped leaves its skills there. A chapter without lessons yet teaches nothing the
 * plan could miss.
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

  const finished = items.filter(
    (item) => LEARN_KINDS.has(item.kind) && isWorkFinished(item.status),
  );

  const [chapters, finishedSkills] = await Promise.all([
    db.chapter.findMany({
      select: {
        id: true,
        lessons: {
          select: {
            lesson: {
              select: { skills: { select: { skillId: true }, where: { skill: visible } } },
            },
          },
          where: { lesson: { ...visible, setAsideAt: null } },
        },
      },
      where: { id: { in: missing } },
    }),
    db.lessonSkill.findMany({
      select: { skillId: true },
      where: { lessonId: { in: finished.flatMap((item) => item.lessonId ?? []) } },
    }),
  ]);

  const taught = new Set([
    ...finishedSkills.map((row) => row.skillId),
    ...finished.flatMap((item) => (isStandIn(item) && item.skillId ? item.skillId : [])),
  ]);

  return new Set(
    chapters.flatMap((chapter) =>
      chapter.lessons.every(({ lesson }) =>
        lesson.skills.every((skill) => taught.has(skill.skillId)),
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

/**
 * Named by a course, never by the goal's title, which the learner can rename: the primary course,
 * or for a plan without one, the course its first chapter was written for. A unit nothing names
 * earns no certificate.
 */
async function nameUnits(
  db: TransactionClient,
  { course, units }: { course: UnitCourse | null; units: readonly CertificateUnit[] },
) {
  if (course) {
    return units.map((unit) => ({ ...unit, title: course.title }));
  }

  const chapterIds = [...new Set(units.flatMap((unit) => unit.chapterIds))];

  const chapters =
    chapterIds.length > 0
      ? await db.chapter.findMany({
          select: { homeCourse: { select: { title: true } }, id: true },
          where: { homeCourseId: { not: null }, id: { in: chapterIds } },
        })
      : [];

  const titles = new Map(chapters.map((chapter) => [chapter.id, chapter.homeCourse?.title]));

  return units.flatMap((unit) => {
    const title = unit.chapterIds.map((id) => titles.get(id)).find(Boolean);
    return title ? { ...unit, title } : [];
  });
}

/**
 * The plan's level and plan certificates, finished or not, with the ones the learner holds and the
 * finished ones they're owed.
 */
export async function loadCertificateUnits(
  { goal, plan }: UnitInput,
  db: TransactionClient = prisma,
) {
  const [course, homeChapters, held, scope] = await Promise.all([
    loadPrimaryCourse(db, goal),
    loadHomeChapters(db, plan),
    loadHeldCertificates(db, goal),
    loadPlanScope({ goal, plan }),
  ]);

  const skillLevels = await loadSkillLevels(db, { goal, plan, scope });

  const levels = new Map(course?.courseChapters.map((entry) => [entry.chapterId, entry.level]));

  const items = plan.items.map((item): CertifiableItem => {
    if (!LEARN_KINDS.has(item.kind)) {
      return { ...item, chapterId: null, level: null };
    }

    const chapterId =
      item.chapterId ?? (item.lessonId ? homeChapters.get(item.lessonId) : null) ?? null;

    const standInLevel = isStandIn(item) ? (skillLevels.get(item.skillId ?? "") ?? null) : null;
    const level = chapterId ? (levels.get(chapterId) ?? null) : standInLevel;

    return { ...item, chapterId, level };
  });

  const taught = await findChaptersTaughtInPlan(db, { course, goal, items, plan });
  const heldKeys = new Set(held.map((row) => row.key));

  const units = listCertificateUnits({
    goal,
    heldKeys,
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
    scope,
    skillLevels: new Map(
      scope.keptSkills.flatMap(({ skillId }) => {
        const level = skillLevels.get(skillId);
        return level ? [[skillId, level] as const] : [];
      }),
    ),
    studiesPastTarget: goal.kind === "exam" && parsePlanSettings(plan.settings).fullCourse,
  });

  const unitKeys = new Set(units.map((unit) => unit.key));

  const due = await nameUnits(db, {
    course,
    units: units.filter((unit) => unit.finished && !heldKeys.has(unit.key)),
  });

  return { due, held: held.filter((row) => unitKeys.has(row.key)), units };
}
