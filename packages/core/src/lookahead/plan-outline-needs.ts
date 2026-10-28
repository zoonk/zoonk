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

export type PlanOutlineNeed = { bands: CourseBandNeed[]; courseId: string; scope: CurriculumScope };

type NeedSkill = Pick<Skill, "description" | "id" | "level" | "name">;

type NeedCourse = Pick<Course, "id" | "language" | "targetLanguage" | "userId" | "visibility">;

type PlanGoal = Pick<
  Goal,
  "details" | "examBlueprintId" | "kind" | "primaryCourseId" | "targetLanguage" | "title"
> & { examBlueprint: ExamBlueprint | null };

const DEFAULT_LEVEL: CourseBandNeed["level"] = "beginner";

async function getHorizon({ days, goalId }: { days: number; goalId: string }): Promise<Date> {
  const goal = await prisma.goal.findUnique({ select: { timezone: true }, where: { id: goalId } });
  const timeZone = getAnswerTimeZone({ goal });

  return addDays(getDateInTimeZone({ date: new Date(), timeZone }), days);
}

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

/** Falls back to the goal's course for graph skills without a course mapping. */
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

type ScopeGoal = Pick<PlanGoal, "details" | "examBlueprint" | "kind" | "targetLanguage" | "title">;

function toGeneralGoal({ exams, goal }: { exams: CandidateExam[]; goal: ScopeGoal }): string {
  if (goal.kind !== "exam") {
    return goal.title;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};
  return toExamIdentity({ details, exams, title: goal.title });
}

/** Private courses preserve their owner; shared exam outlines use exam identity rather than learner wording. */
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

/** Workflow bridge: authorize goalId first. Returns only wholly untaught skills; partially taught ones need extensions. */
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

  return courseIds.flatMap((courseId) =>
    needs.filter((need) => need.courseId === courseId && need.bands.length > 0),
  );
}

/** Includes partially taught skills; they need extensions rather than an early outline request. */
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

/** Workflow bridge: authorize goalId first. Null means no stand-in; taught means nothing needs writing. */
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

/** Workflow bridge: authorize goalId first; returns courses whose visible reserved time needs foreground outlines. */
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

/** Workflow bridge: authorize goalId first; includes real lessons and stand-ins within days of the goal's local today. */
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
