import "server-only";
import { type CourseLevel, type Goal, type LibraryVisibility, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { addDays } from "../../plans/planner/plan-calendar";
import { type PlanGraphSkill, parsePlanGraph } from "../../plans/planner/plan-state";
import { countStandInLessons } from "../../plans/planner/plan-units";
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

/** Stand-ins due within this many days get their skill's next chapter written. */
const EXTENSION_HORIZON_DAYS = 14;

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
  const teaching = placements
    .map((placement) => ({
      lessons: getSkillLessons({ placement, skillId: extension.skill.id }),
      placement,
    }))
    .filter((entry) => entry.lessons.length > 0);

  const taught = new Set(teaching.flatMap((entry) => entry.lessons.map((lesson) => lesson.id)));
  const missing = countStandInLessons({ lessons: extension.lessons, taught: taught.size });
  const last = teaching.at(-1);

  if (!last || missing <= 0) {
    return [];
  }

  return [
    {
      afterChapterId: last.placement.chapterId,
      chapters: teaching.map((entry) => ({
        lessons: entry.lessons.map((lesson) => lesson.title),
        title: entry.placement.chapter.title,
      })),
      lessons: Math.min(missing, MAX_EXTENSION_LESSONS),
      level: last.placement.level,
      skill: extension.skill,
    },
  ];
}

/**
 * What the next chapter of each skill needs: the chapters of the course that teach it so far, in
 * order, with their lessons, the band of the last one, and how many lessons it should have, for
 * the skills whose plans keep a stand-in for lessons the course doesn't have yet (the rule plans
 * follow). A skill the course doesn't teach at all is left out: the regular outline writes its
 * first chapters.
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
      scheduledFor: { lte: addDays(today, EXTENSION_HORIZON_DAYS) },
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

function groupByBand(plans: readonly ExtensionPlan[], graphSkills: readonly PlanGraphSkill[]) {
  const levels = [...new Set(plans.map((plan) => plan.level))];

  return levels.map((level): CourseBandNeed => ({
    extend: plans
      .filter((plan) => plan.level === level)
      .map((plan) => ({
        lessons: graphSkills.find((skill) => skill.skillId === plan.skill.id)?.lessons ?? 0,
        skill: plan.skill,
      })),
    level,
    skills: [],
  }));
}

async function toCourseRequest({
  course,
  graphSkills,
  skillRefs,
}: {
  course: ExtensionCourse;
  graphSkills: readonly PlanGraphSkill[];
  skillRefs: readonly GoalSkillRef[];
}): Promise<CourseExtensionRequest[]> {
  const scope = toCourseScope(course);

  const plans = await planSkillExtensions({
    courseId: course.id,
    extensions: skillRefs.map((skill) => ({
      lessons: graphSkills.find((graphSkill) => graphSkill.skillId === skill.id)?.lessons ?? 0,
      skill,
    })),
    ownerId: scope.ownerId,
  });

  return plans.length > 0
    ? [{ bands: groupByBand(plans, graphSkills), courseId: course.id, scope }]
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
 * the Library hasn't outlined, while a chapter's worth or more is missing) is due within two weeks,
 * the next chapter of the course that already teaches it in part, grouped by course and band. A
 * course whose outline is being written is left alone: that run may be writing them, and the next
 * preparation asks again for what's still missing.
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
    select: { plan: { select: { graph: true } }, primaryCourseId: true, status: true },
    where: { id: goalId },
  });

  if (!goal?.plan || goal.status !== "active") {
    return [];
  }

  const soon = await loadSoonStandInSkillIds({ goalId, timeZone });

  const graphSkills = parsePlanGraph(goal.plan.graph).skills.filter((skill) =>
    soon.has(skill.skillId),
  );

  const courseIds = [
    ...new Set(graphSkills.flatMap((skill) => getSkillCourseId({ goal, skill }) ?? [])),
  ];

  if (courseIds.length === 0) {
    return [];
  }

  const [courses, skills] = await Promise.all([
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
  ]);

  const requests = await Promise.all(
    courses.map((course) =>
      toCourseRequest({
        course,
        graphSkills,
        skillRefs: graphSkills
          .filter((graphSkill) => getSkillCourseId({ goal, skill: graphSkill }) === course.id)
          .flatMap((graphSkill) => skills.filter((skill) => skill.id === graphSkill.skillId))
          .map((skill) => ({ ...skill, key: skill.id })),
      }),
    ),
  );

  return requests.flat();
}
