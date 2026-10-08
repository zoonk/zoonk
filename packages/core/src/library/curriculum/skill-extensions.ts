import "server-only";
import { type CourseLevel, type Goal, type LibraryVisibility, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { OUTLINE_AHEAD_DAYS } from "../../lookahead/outline-ahead";
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

/** One run adds one chapter to a skill, of at most this many lessons. */
const MAX_EXTENSION_LESSONS = 10;

/** A chapter that teaches a skill, as the next chapter's outline needs to continue it. */
type SkillChapter = { lessons: string[]; title: string };

/**
 * The next chapter a skill needs: after these chapters, placed right after the last of them
 * (`afterChapterId`) in its band, of about `lessons` lessons.
 */
export type ExtensionPlan = {
  afterChapterId: string;
  chapters: SkillChapter[];
  lessons: number;
  level: CourseLevel;
  skill: GoalSkillRef;
};

/** A course whose band needs the next chapters of skills it teaches in part. */
export type CourseExtensionRequest = {
  bands: CourseBandNeed[];
  courseId: string;
  scope: CurriculumScope;
};

type Placement = Awaited<ReturnType<typeof loadSkillPlacements>>[number];

/** The course's chapters that teach any of these skills, in course order, with their lessons. */
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

/**
 * The lessons of a chapter that teach a skill: all of them when an outline tagged the chapter with
 * it, else those that name it. Chapter challenges aren't lessons of a skill, as plans count them.
 */
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
  // Every chapter that teaches the skill says what the next one mustn't repeat, chapters the
  // goal's plan leaves out (ones that need a tool) included.
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

/**
 * What the next chapter of each skill needs: the chapters of the course that teach it so far, in
 * order, with their lessons, the band of the last one, and how many lessons it should have: its
 * plan's stand-in, at most a chapter's worth. A skill the course doesn't teach at all is left out:
 * the regular outline writes its first chapters.
 *
 * This is a workflow bridge: the owner comes from the course a goal's plan already uses.
 */
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

/** The skills whose stand-in (the lessons the Library hasn't outlined yet) is due soon. */
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

/** Shared courses are written for everyone; a private one stays its owner's. */
function toCourseScope(course: ExtensionCourse): CurriculumScope {
  return {
    generalGoal: null,
    language: course.language,
    ownerId: course.visibility === "private" ? course.userId : null,
    targetLanguage: course.targetLanguage,
  };
}

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
  withToolChapters,
}: {
  course: ExtensionCourse;
  extensions: readonly SkillExtension[];
  withToolChapters: boolean;
}): Promise<CourseExtensionRequest[]> {
  const scope = toCourseScope(course);

  const plans = await planSkillExtensions({
    courseId: course.id,
    extensions,
    ownerId: scope.ownerId,
  });

  return plans.length > 0
    ? [{ bands: groupByBand({ extensions, plans, withToolChapters }), courseId: course.id, scope }]
    : [];
}

/** The course a plan learns a skill in: the one its graph names, else the goal's own course. */
function getSkillCourseId({
  goal,
  skill,
}: {
  goal: Pick<Goal, "primaryCourseId">;
  skill: PlanGraphSkill;
}): string | null {
  return skill.courseIds?.[0] ?? goal.primaryCourseId;
}

/**
 * The next chapters a goal's plan needs soon: for each skill whose stand-in (the part of the skill
 * the Library hasn't outlined, while a chapter's worth or more is missing; see
 * `getStandInLessons`) is due within two weeks, the next chapter of the course that already
 * teaches it in part, grouped by course and band. A course whose outline is being written is left
 * alone: that run may be writing them, and the next preparation asks again for what's still
 * missing.
 *
 * This is a workflow bridge: the goal comes from the learner's own session.
 */
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
      examBlueprintId: true,
      kind: true,
      plan: { select: { graph: true } },
      primaryCourseId: true,
      status: true,
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

  // The plan's own stand-ins, so the Library writes exactly the lessons the plan waits for.
  const standIns = getStandInLessons({ lessons, skills: graph.skills });

  const requests = await Promise.all(
    courses.map((course) =>
      toCourseRequest({
        course,
        extensions: graphSkills
          .filter((graphSkill) => getSkillCourseId({ goal, skill: graphSkill }) === course.id)
          .flatMap((graphSkill) => skills.filter((skill) => skill.id === graphSkill.skillId))
          .map((skill) => ({
            lessons: standIns.get(skill.id) ?? 0,
            skill: { ...skill, key: skill.id },
          })),
        withToolChapters,
      }),
    ),
  );

  return requests.flat();
}
