import "server-only";
import { type Course, type ExamBlueprint, type Goal, type Skill, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { findUntaughtSkills } from "../library/curriculum/course-outline-state";
import { type CourseBandNeed, type CurriculumScope } from "../library/curriculum/curriculum-scope";
import { toExamIdentity } from "../library/curriculum/shared-graph-prompt";
import { type CandidateExam, toGoalCandidateExams } from "../library/exams/candidate-exams";
import { goalUsesTools } from "../plans/_utils/plan-tools";
import { isStandIn } from "../plans/_utils/stand-in-lessons";
import { addDays } from "../plans/planner/plan-calendar";
import { type ExistingPlanItem } from "../plans/planner/plan-items";
import { parsePlanGraph } from "../plans/planner/plan-state";

/** One course of an existing plan with the level bands its stand-ins still need outlined. */
export type PlanOutlineNeed = { bands: CourseBandNeed[]; courseId: string; scope: CurriculumScope };

type NeedSkill = Pick<Skill, "description" | "id" | "level" | "name">;

type NeedCourse = Pick<Course, "id" | "language" | "targetLanguage" | "userId" | "visibility">;

type PlanGoal = Pick<
  Goal,
  "details" | "examBlueprintId" | "kind" | "primaryCourseId" | "targetLanguage" | "title"
> & { examBlueprint: ExamBlueprint | null };

/** A skill without a level is outlined with the course's first band. */
const DEFAULT_LEVEL: CourseBandNeed["level"] = "beginner";

/** The last day of the plan within `days` of today in the goal's time zone. */
async function getHorizon({ days, goalId }: { days: number; goalId: string }): Promise<Date> {
  const goal = await prisma.goal.findUnique({ select: { timezone: true }, where: { id: goalId } });
  const timeZone = getAnswerTimeZone({ goal });

  return addDays(getDateInTimeZone({ date: new Date(), timeZone }), days);
}

/**
 * The stand-ins' skills (plan items waiting for a lesson) scheduled by `until` (every one without
 * it), in plan order, once each.
 */
async function loadStandIns({ goalId, until }: { goalId: string; until: Date | null }) {
  const plan = await prisma.plan.findUnique({
    select: {
      goal: {
        select: {
          details: true,
          examBlueprint: true,
          examBlueprintId: true,
          kind: true,
          primaryCourseId: true,
          targetLanguage: true,
          title: true,
        },
      },
      graph: true,
      items: {
        orderBy: { position: "asc" },
        select: { skillId: true },
        where: {
          kind: "lesson",
          lessonId: null,
          ...(until ? { scheduledFor: { lte: until } } : {}),
          skillId: { not: null },
          status: "todo",
        },
      },
    },
    where: { goalId },
  });

  const skillIds = (plan?.items ?? []).flatMap((item) => (item.skillId ? [item.skillId] : []));

  return plan ? { goal: plan.goal, graph: plan.graph, skillIds: [...new Set(skillIds)] } : null;
}

/**
 * The Library course each plan skill takes its lessons from: the one its graph names, else the
 * goal's own course, where the planner learns a skill a change added (a topic the learner asked
 * for, a prerequisite) and the next chapters of a skill are written too.
 */
export function readSkillCourses({
  graph,
  primaryCourseId,
}: {
  graph: unknown;
  primaryCourseId: string | null;
}): Map<string, string> {
  return new Map(
    parsePlanGraph(graph).skills.flatMap((skill) => {
      const courseId = skill.courseIds?.[0] ?? primaryCourseId;
      return courseId ? [[skill.skillId, courseId] as const] : [];
    }),
  );
}

/**
 * Level bands in the order the learner reaches their first stand-in, each skill with its area in
 * the plan's graph. A goal answered without tools of its own (an exam that isn't practical) has
 * them taught in chapters without tools.
 */
function toBands({
  areas,
  skills,
  withToolChapters,
}: {
  areas: ReadonlyMap<string, string | null>;
  skills: readonly NeedSkill[];
  withToolChapters: boolean;
}): CourseBandNeed[] {
  const byLevel = Map.groupBy(skills, (skill) => skill.level ?? DEFAULT_LEVEL);

  return [...byLevel.entries()].map(([level, bandSkills]) => ({
    level,
    skills: bandSkills.map(({ description, id, name }) => ({
      area: areas.get(id) ?? null,
      description,
      id,
      key: id,
      name,
    })),
    withToolChapters,
  }));
}

/** The goal fields a course's outline scope reads. */
type ScopeGoal = Pick<PlanGoal, "details" | "examBlueprint" | "kind" | "targetLanguage" | "title">;

/** A shared course's outline sees the goal's title, or for an exam the exam (`toExamIdentity`). */
function toGeneralGoal({ exams, goal }: { exams: CandidateExam[]; goal: ScopeGoal }): string {
  if (goal.kind !== "exam") {
    return goal.title;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};
  return toExamIdentity({ details, exams, title: goal.title });
}

/**
 * Who a plan's course is outlined for, whether the run writes its first chapters or a skill's next
 * one: a private course for its owner; a shared one for the goal, or for an exam its candidates.
 */
export function toPlanCourseScope({
  course,
  goal,
}: {
  course: NeedCourse;
  goal: ScopeGoal;
}): CurriculumScope {
  const ownerId = course.visibility === "private" ? course.userId : null;

  const exams = ownerId
    ? []
    : toGoalCandidateExams({ blueprint: goal.examBlueprint, kind: goal.kind });

  return {
    exams,
    generalGoal: ownerId ? null : toGeneralGoal({ exams, goal }),
    language: course.language,
    ownerId,
    targetLanguage: course.targetLanguage ?? goal.targetLanguage,
  };
}

/**
 * The outlines a plan still needs before its stand-ins become lessons, the course and band the
 * learner reaches first first: a plan started from a plan link or a course keeps the Library
 * courses it came with, and a plan whose later bands weren't outlined when it was built gets them
 * as it gets close (`days`: only stand-ins scheduled within that many days). Only
 * skills their course doesn't teach at all are listed: one it teaches in part gets its next
 * chapter from `listSkillExtensions`.
 * Courses keep their own language and owner; a shared course's outline sees only the goal's title,
 * or for an exam the exam itself.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function listPlanOutlineNeeds({
  days,
  goalId,
}: {
  days: number;
  goalId: string;
}): Promise<PlanOutlineNeed[]> {
  const until = await getHorizon({ days, goalId });
  const standIns = await loadStandIns({ goalId, until });

  if (!standIns || standIns.skillIds.length === 0) {
    return [];
  }

  return toOutlineNeeds(standIns);
}

type StandIns = NonNullable<Awaited<ReturnType<typeof loadStandIns>>>;

/** The outlines the stand-ins need, by course and band, the course the learner reaches first first. */
async function toOutlineNeeds(standIns: StandIns): Promise<PlanOutlineNeed[]> {
  const courseOf = readSkillCourses({
    graph: standIns.graph,
    primaryCourseId: standIns.goal.primaryCourseId,
  });

  const courseIds = [...new Set(standIns.skillIds.flatMap((id) => courseOf.get(id) ?? []))];

  const areas = new Map(
    parsePlanGraph(standIns.graph).skills.map((skill) => [skill.skillId, skill.area] as const),
  );

  const [skills, courses, withToolChapters] = await Promise.all([
    prisma.skill.findMany({
      select: { description: true, id: true, level: true, name: true },
      where: { id: { in: standIns.skillIds } },
    }),
    prisma.course.findMany({
      select: { id: true, language: true, targetLanguage: true, userId: true, visibility: true },
      where: { id: { in: courseIds } },
    }),
    goalUsesTools(standIns.goal),
  ]);

  const ordered = standIns.skillIds.flatMap((id) => skills.find((skill) => skill.id === id) ?? []);

  const needs = await Promise.all(
    courses.map(async (course) => {
      const scope = toPlanCourseScope({ course, goal: standIns.goal });
      const courseSkills = ordered.filter((skill) => courseOf.get(skill.id) === course.id);

      // A skill its course teaches in part gets its next chapter as an extension instead.
      const untaught = new Set(
        await findUntaughtSkills({
          courseId: course.id,
          ownerId: scope.ownerId,
          skillIds: courseSkills.map((skill) => skill.id),
          withToolChapters,
        }),
      );

      const bands = toBands({
        areas,
        skills: courseSkills.filter((skill) => untaught.has(skill.id)),
        withToolChapters,
      });

      return { bands, courseId: course.id, scope };
    }),
  );

  // Courses in the order the learner reaches their first stand-in.
  return courseIds.flatMap((courseId) =>
    needs.filter((need) => need.courseId === courseId && need.bands.length > 0),
  );
}

/**
 * The plan's stand-in skills (lessons not written yet) a chapter of their course already teaches,
 * as `findUntaughtSkills` counts them: the plan writes their next chapter as the learner gets close
 * (`listSkillExtensions`), so a far topic offers none of them to ask for early, which would only
 * read back the chapters the plan lists already.
 */
export async function listTaughtStandInSkills({
  blueprint,
  goal,
  graph,
  items,
}: {
  /** The exam's blueprint a GET already read, so it isn't read again. */
  blueprint?: Pick<ExamBlueprint, "structure"> | null;
  goal: Pick<Goal, "examBlueprintId" | "kind" | "primaryCourseId">;
  graph: unknown;
  items: readonly Pick<
    ExistingPlanItem,
    "chapterId" | "kind" | "lessonId" | "skillId" | "status"
  >[];
}): Promise<Set<string>> {
  const skillIds = [
    ...new Set(
      items.flatMap((item) =>
        isStandIn(item) && item.status === "todo" && item.skillId ? [item.skillId] : [],
      ),
    ),
  ];

  if (skillIds.length === 0) {
    return new Set();
  }

  const courseOf = readSkillCourses({ graph, primaryCourseId: goal.primaryCourseId });
  const courseIds = [...new Set(skillIds.flatMap((id) => courseOf.get(id) ?? []))];

  const [courses, withToolChapters] = await Promise.all([
    prisma.course.findMany({
      select: { id: true, userId: true, visibility: true },
      where: { id: { in: courseIds } },
    }),
    goalUsesTools(goal, blueprint),
  ]);

  const untaught = await Promise.all(
    courses.map((course) =>
      findUntaughtSkills({
        courseId: course.id,
        ownerId: course.visibility === "private" ? course.userId : null,
        skillIds: skillIds.filter((id) => courseOf.get(id) === course.id),
        withToolChapters,
      }),
    ),
  );

  const untaughtIds = new Set(untaught.flat());
  const found = new Set(courses.map((course) => course.id));

  return new Set(
    skillIds.filter((id) => found.has(courseOf.get(id) ?? "") && !untaughtIds.has(id)),
  );
}

/**
 * What a far topic needs when the learner asks to see its lessons before the plan gets close: the
 * band its skill is in (its course and level), with the plan's other stand-ins in that band, so
 * one outline writes them together (`untaught`). `taught` when the course already teaches the
 * skill, so nothing needs writing; null when the plan has no stand-in for the skill.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary loaded.
 */
export async function findSkillOutlineNeed({
  goalId,
  skillId,
}: {
  goalId: string;
  skillId: string;
}): Promise<
  { courseId: string; status: "taught" } | { need: PlanOutlineNeed; status: "untaught" } | null
> {
  const standIns = await loadStandIns({ goalId, until: null });

  if (!standIns?.skillIds.includes(skillId)) {
    return null;
  }

  const courseOf = readSkillCourses({
    graph: standIns.graph,
    primaryCourseId: standIns.goal.primaryCourseId,
  });

  const courseId = courseOf.get(skillId);

  if (!courseId) {
    return null;
  }

  const [need] = await toOutlineNeeds({
    ...standIns,
    skillIds: standIns.skillIds.filter((id) => courseOf.get(id) === courseId),
  });

  const band = need?.bands.find((item) => item.skills.some((skill) => skill.id === skillId));

  if (!need || !band) {
    return { courseId, status: "taught" };
  }

  return { need: { ...need, bands: [band] }, status: "untaught" };
}

/**
 * The Library courses whose stand-ins (lessons not outlined yet, a skill's first chapters or its
 * next one) the plan schedules within `days` of today. Today holds their time and says more
 * lessons are on the way, so their outline isn't background work.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary loaded.
 */
export async function listSoonStandInCourseIds({
  days,
  goalId,
}: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  const until = await getHorizon({ days, goalId });
  const standIns = await loadStandIns({ goalId, until });

  if (!standIns) {
    return [];
  }

  const courseOf = readSkillCourses({
    graph: standIns.graph,
    primaryCourseId: standIns.goal.primaryCourseId,
  });

  return [...new Set(standIns.skillIds.flatMap((id) => courseOf.get(id) ?? []))];
}

/**
 * The skills the plan gets to within `days` of today: every one with a lesson or a stand-in
 * scheduled by then. A plan is built with only these skills' course bands outlined (the learner's
 * `outlineDays`, see `getLookahead`); the rest are outlined as the plan gets close.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function listPlanSkillIdsWithin({
  days,
  goalId,
}: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  const until = await getHorizon({ days, goalId });

  const items = await prisma.planItem.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: {
      kind: "lesson",
      plan: { goalId },
      scheduledFor: { lte: until },
      skillId: { not: null },
    },
  });

  return items.flatMap((item) => (item.skillId ? [item.skillId] : []));
}
