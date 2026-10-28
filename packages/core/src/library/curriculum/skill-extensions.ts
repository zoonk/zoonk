import "server-only";
import { type CourseLevel, type Goal, type LibraryVisibility, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { OUTLINE_AHEAD_DAYS } from "../../lookahead/outline-ahead";
import { toPlanCourseScope } from "../../lookahead/plan-outline-needs";
import { goalUsesTools } from "../../plans/_utils/plan-tools";
import { loadGoalPlannerLessons } from "../../plans/_utils/planner-lessons";
import { addDays } from "../../plans/planner/plan-calendar";
import { type PlanGraphSkill, parsePlanGraph } from "../../plans/planner/plan-state";
import { getStandInLessons } from "../../plans/planner/plan-units";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { isChallengeIdentityKey } from "../challenges/challenge-lesson-spec";
import {
  type CourseBandNeed,
  type CurriculumScope,
  type GoalSkillRef,
  type SkillExtension,
} from "./curriculum-scope";

const MAX_EXTENSION_LESSONS = 10;

type SkillChapter = { lessons: string[]; title: string };

export type ExtensionPlan = {
  afterChapterId: string;
  chapters: SkillChapter[];
  lessons: number;
  level: CourseLevel;
  skill: GoalSkillRef;
};

export type CourseExtensionRequest = {
  bands: CourseBandNeed[];
  courseId: string;
  scope: CurriculumScope;
};

type Placement = Awaited<ReturnType<typeof loadSkillPlacements>>[number];

function loadSkillPlacements({
  courseId,
  ownerId,
  skillIds,
}: {
  courseId: string;
  ownerId: string | null;
  skillIds: readonly string[];
}) {
  const visible = libraryRowsVisibleTo(ownerId);
  const inSkills = { skillId: { in: [...skillIds] } };

  return prisma.courseChapter.findMany({
    orderBy: [{ level: "asc" }, { position: "asc" }],
    select: {
      chapter: {
        select: {
          goalSkills: { select: { skillId: true }, where: inSkills },
          lessons: {
            orderBy: { position: "asc" },
            select: {
              lesson: {
                select: {
                  id: true,
                  identityKey: true,
                  skills: { select: { skillId: true }, where: inSkills },
                  title: true,
                },
              },
            },
            where: { lesson: visible },
          },
          title: true,
          tools: true,
        },
      },
      chapterId: true,
      level: true,
    },
    where: {
      chapter: {
        ...visible,
        OR: [
          { goalSkills: { some: inSkills } },
          { lessons: { some: { lesson: { skills: { some: inSkills } } } } },
        ],
      },
      courseId,
    },
  });
}

function getSkillLessons({ placement, skillId }: { placement: Placement; skillId: string }) {
  const lessons = placement.chapter.lessons
    .map((entry) => entry.lesson)
    .filter((lesson) => !isChallengeIdentityKey(lesson.identityKey));

  const tagged = placement.chapter.goalSkills.some((skill) => skill.skillId === skillId);

  return tagged
    ? lessons
    : lessons.filter((lesson) => lesson.skills.some((skill) => skill.skillId === skillId));
}

function planExtension({
  extension,
  placements,
}: {
  extension: SkillExtension;
  placements: readonly Placement[];
}): ExtensionPlan[] {
  const teaching = placements
    .map((placement) => ({
      lessons: getSkillLessons({ placement, skillId: extension.skill.id }),
      placement,
    }))
    .filter((entry) => entry.lessons.length > 0);

  const last = teaching.at(-1);

  if (!last || extension.lessons <= 0) {
    return [];
  }

  return [
    {
      afterChapterId: last.placement.chapterId,
      chapters: teaching.map((entry) => ({
        lessons: entry.lessons.map((lesson) => lesson.title),
        title: entry.placement.chapter.title,
      })),
      lessons: Math.min(extension.lessons, MAX_EXTENSION_LESSONS),
      level: last.placement.level,
      skill: extension.skill,
    },
  ];
}

/** Internal workflow bridge: derive the owner from the course the authorized goal's plan uses. */
export async function planSkillExtensions({
  courseId,
  extensions,
  ownerId,
}: {
  courseId: string;
  extensions: readonly SkillExtension[];
  ownerId: string | null;
}): Promise<ExtensionPlan[]> {
  if (extensions.length === 0) {
    return [];
  }

  const placements = await loadSkillPlacements({
    courseId,
    ownerId,
    skillIds: extensions.map((extension) => extension.skill.id),
  });

  return extensions.flatMap((extension) => planExtension({ extension, placements }));
}

async function loadSoonStandInSkillIds({ goalId, timeZone }: { goalId: string; timeZone: string }) {
  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const items = await prisma.planItem.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: {
      chapterId: null,
      kind: "lesson",
      lessonId: null,
      plan: { goalId },
      scheduledFor: { lte: addDays(today, OUTLINE_AHEAD_DAYS) },
      skillId: { not: null },
      status: "todo",
    },
  });

  return new Set(items.flatMap((item) => (item.skillId ? [item.skillId] : [])));
}

type ExtensionCourse = {
  id: string;
  language: string;
  targetLanguage: string | null;
  userId: string | null;
  visibility: LibraryVisibility;
};

function groupByBand({
  extensions,
  plans,
  withToolChapters,
}: {
  extensions: readonly SkillExtension[];
  plans: readonly ExtensionPlan[];
  withToolChapters: boolean;
}) {
  const levels = [...new Set(plans.map((plan) => plan.level))];

  return levels.map((level): CourseBandNeed => ({
    extend: extensions.filter((extension) =>
      plans.some((plan) => plan.level === level && plan.skill.id === extension.skill.id),
    ),
    level,
    skills: [],
    withToolChapters,
  }));
}

async function toCourseRequest({
  course,
  extensions,
  goal,
  withToolChapters,
}: {
  course: ExtensionCourse;
  extensions: readonly SkillExtension[];
  goal: Parameters<typeof toPlanCourseScope>[0]["goal"];
  withToolChapters: boolean;
}): Promise<CourseExtensionRequest[]> {
  const scope = toPlanCourseScope({ course, goal });

  const plans = await planSkillExtensions({
    courseId: course.id,
    extensions,
    ownerId: scope.ownerId,
  });

  return plans.length > 0
    ? [{ bands: groupByBand({ extensions, plans, withToolChapters }), courseId: course.id, scope }]
    : [];
}

function getSkillCourseId({
  goal,
  skill,
}: {
  goal: Pick<Goal, "primaryCourseId">;
  skill: PlanGraphSkill;
}): string | null {
  return skill.courseIds?.[0] ?? goal.primaryCourseId;
}

/** Internal workflow bridge: the goal must come from the learner's own session. */
export async function listSkillExtensions({
  goalId,
  timeZone,
}: {
  goalId: string;
  timeZone: string;
}): Promise<CourseExtensionRequest[]> {
  const goal = await prisma.goal.findUnique({
    select: {
      details: true,
      examBlueprint: true,
      examBlueprintId: true,
      kind: true,
      plan: { select: { graph: true } },
      primaryCourseId: true,
      status: true,
      targetLanguage: true,
      title: true,
      userId: true,
    },
    where: { id: goalId },
  });

  if (!goal?.plan || goal.status !== "active") {
    return [];
  }

  const graph = parsePlanGraph(goal.plan.graph);
  const soon = await loadSoonStandInSkillIds({ goalId, timeZone });
  const graphSkills = graph.skills.filter((skill) => soon.has(skill.skillId));

  const courseIds = [
    ...new Set(graphSkills.flatMap((skill) => getSkillCourseId({ goal, skill }) ?? [])),
  ];

  if (courseIds.length === 0) {
    return [];
  }

  const [courses, skills, withToolChapters, lessons] = await Promise.all([
    prisma.course.findMany({
      select: { id: true, language: true, targetLanguage: true, userId: true, visibility: true },
      where: {
        OR: [{ outlineStatus: null }, { outlineStatus: { not: "running" } }],
        id: { in: courseIds },
      },
    }),
    prisma.skill.findMany({
      select: { description: true, id: true, name: true },
      where: { id: { in: graphSkills.map((skill) => skill.skillId) } },
    }),
    goalUsesTools(goal),
    loadGoalPlannerLessons({ goal, graph, userId: goal.userId }),
  ]);

  const standIns = getStandInLessons({ lessons, skills: graph.skills });

  const requests = await Promise.all(
    courses.map((course) =>
      toCourseRequest({
        course,
        extensions: graphSkills
          .filter((graphSkill) => getSkillCourseId({ goal, skill: graphSkill }) === course.id)
          .flatMap((graphSkill) =>
            skills
              .filter((skill) => skill.id === graphSkill.skillId)
              .map((skill) => ({
                lessons: standIns.get(skill.id) ?? 0,
                skill: { ...skill, area: graphSkill.area, key: skill.id },
              })),
          ),
        goal,
        withToolChapters,
      }),
    ),
  );

  return requests.flat();
}
