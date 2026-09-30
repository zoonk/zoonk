import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { withClassTestMock } from "../../exams/mocks/class-test-mock";
import { getWeeklyMockMinutes } from "../../exams/mocks/mock-plan";
import { toSkillStatus } from "../../learner/_utils/skill-status";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import {
  compareCourseOrder,
  getCourseOrder,
  loadChapterTaughtLessons,
  mergePlannerLessons,
} from "../../library/curriculum/chapter-taught-lessons";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { type PlanGraph } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";
import { type SkillReadiness } from "../planner/skill-order";
import { type SkillCourses, getSkillCourses, pickSkillPlaces } from "./skill-courses";

/**
 * Plans may point at a skill merged into another since; the learner's state and the lessons live
 * on the survivor. Duplicates that merged into one skill keep their first place.
 */
export async function resolveMergedSkills(graph: PlanGraph): Promise<PlanGraph> {
  const survivorOf = await loadSkillSurvivors(graph.skills.map((skill) => skill.skillId));
  const skills = graph.skills.map((skill) => ({ ...skill, skillId: survivorOf(skill.skillId) }));

  return {
    ...graph,
    skills: skills.filter(
      (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
    ),
  };
}

/**
 * The Library lessons that teach the plan's skills, in course order (level band, chapter, then
 * lesson), so a skill taught in several chapters meets them in the course's order. A skill with
 * courses only takes lessons its courses' chapters hold, planned in one of those chapters.
 * Private lessons count only for their owner, so one learner's private course never shows up in
 * another's plan.
 */
async function loadLessons({
  skillCourses,
  skillIds,
  userId,
}: {
  skillCourses: SkillCourses;
  skillIds: string[];
  userId: string;
}): Promise<PlannerLesson[]> {
  const rows = await prisma.lessonSkill.findMany({
    select: {
      lesson: {
        select: {
          chapters: {
            select: {
              chapter: {
                select: {
                  courses: {
                    orderBy: { createdAt: "asc" },
                    select: { courseId: true, level: true, position: true },
                  },
                },
              },
              chapterId: true,
              position: true,
            },
          },
          createdAt: true,
          estimatedMinutes: true,
          homeChapterId: true,
          id: true,
          title: true,
        },
      },
      skillId: true,
    },
    where: {
      // A lesson set aside after its last held-back draft can't be taught: plans leave it out.
      lesson: { ...libraryRowsVisibleTo(userId), setAsideAt: null },
      skillId: { in: skillIds },
    },
  });

  const taught = rows.flatMap((row) => {
    const chapters = pickSkillPlaces({
      getCourseIds: (entry) => entry.chapter.courses.map((placement) => placement.courseId),
      places: row.lesson.chapters,
      skillCourses,
      skillId: row.skillId,
    });

    return chapters ? [{ ...row, chapters }] : [];
  });

  const lessons = new Map(taught.map((row) => [row.lesson.id, row]));

  return [...lessons.values()]
    .map(({ chapters, lesson, skillId }) => {
      const chapter =
        chapters.find((entry) => entry.chapterId === lesson.homeChapterId) ?? chapters[0];

      const courses = skillCourses.get(skillId);

      const placement =
        chapter?.chapter.courses.find((entry) => !courses || courses.includes(entry.courseId)) ??
        chapter?.chapter.courses[0];

      return {
        chapterId: chapter?.chapterId ?? lesson.homeChapterId,
        createdAt: lesson.createdAt,
        lessonId: lesson.id,
        minutes: lesson.estimatedMinutes,
        order: getCourseOrder({ lessonPosition: chapter?.position ?? 0, placement }),
        skillIds: taught.filter((row) => row.lesson.id === lesson.id).map((row) => row.skillId),
        title: lesson.title,
      };
    })
    .toSorted(
      (a, b) =>
        compareCourseOrder(a.order, b.order) || a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .map(({ chapterId, lessonId, minutes, skillIds: taughtIds, title }) => ({
      chapterId,
      lessonId,
      minutes,
      skillIds: taughtIds,
      title,
    }));
}

async function loadPrerequisites(skillIds: string[]): Promise<Map<string, string[]>> {
  const edges = await prisma.skillPrerequisite.findMany({
    select: { prerequisiteId: true, skillId: true },
    where: { prerequisiteId: { in: skillIds }, skillId: { in: skillIds } },
  });

  return edges.reduce((map, edge) => {
    map.set(edge.skillId, [...(map.get(edge.skillId) ?? []), edge.prerequisiteId]);
    return map;
  }, new Map<string, string[]>());
}

/** For exam priority: each skill's state and how much of it will be remembered on the exam day. */
async function loadReadiness({
  skillIds,
  targetDate,
  userId,
}: {
  skillIds: string[];
  targetDate: Date | null;
  userId: string;
}): Promise<Map<string, SkillReadiness>> {
  if (!targetDate) {
    return new Map();
  }

  const rows = await prisma.learnerSkill.findMany({ where: { skillId: { in: skillIds }, userId } });

  return new Map(
    rows.map((row) => {
      const status = toSkillStatus({ learnerSkill: row, now: targetDate });

      return [
        row.skillId,
        {
          reps: row.reps,
          retrievabilityAtTarget: status.retrievability,
          stability: row.stability,
          state: status.state,
        },
      ];
    }),
  );
}

type MockMinutes = { mockMinutes: number; shortMockMinutes: number | null };

/**
 * How long the exam's mocks take: the weekly mock, the first exam day's sections at the real pace
 * with half of each on regular weeks, as the exam module plans it; and for a class test read from
 * the learner's own material (a private blueprint), its short mock at full length, which rehearses
 * it the day before when the test is days away.
 */
async function loadMockMinutes(goal: Pick<Goal, "examBlueprintId">): Promise<MockMinutes> {
  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({
        select: { ownerId: true, structure: true },
        where: { id: goal.examBlueprintId },
      })
    : null;

  const parsed = examStructureSchema.safeParse(blueprint?.structure).data ?? null;
  const ownerId = blueprint?.ownerId ?? null;
  const structure = parsed && withClassTestMock({ ownerId, structure: parsed });

  return {
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure }),
    shortMockMinutes: ownerId ? getWeeklyMockMinutes({ fullLength: true, structure }) : null,
  };
}

/**
 * The Library lessons a plan turns these skills into: the lessons that teach each one, and the
 * lessons of the chapters a course outline tagged with it (a graph skill that spans several
 * lessons), in course order.
 */
export async function loadSkillLessons({
  goal,
  skillCourses = new Map(),
  skillIds,
  userId,
}: {
  goal: Pick<Goal, "kind">;
  /** The courses the goal learns its skills in; skills left out take lessons from any course. */
  skillCourses?: SkillCourses;
  skillIds: string[];
  userId: string;
}): Promise<PlannerLesson[]> {
  const [taught, chapterTaught] = await Promise.all([
    loadLessons({ skillCourses, skillIds, userId }),
    loadChapterTaughtLessons({
      skillCourses,
      skillIds,
      userId,
      withChallenges: goal.kind === "learn",
    }),
  ]);

  return mergePlannerLessons({ chapterTaught, taught });
}

/** Reads what the planner needs from the Library and the learner model for one goal's graph. */
export async function loadPlannerInputs({
  goal,
  graph,
  targetDate,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  graph: PlanGraph;
  targetDate: Date | null;
  userId: string;
}) {
  const skillIds = graph.skills.map((skill) => skill.skillId);
  const isExam = goal.kind === "exam";

  const [lessons, prerequisites, readiness, mocks] = await Promise.all([
    loadSkillLessons({ goal, skillCourses: getSkillCourses(graph), skillIds, userId }),
    loadPrerequisites(skillIds),
    loadReadiness({ skillIds, targetDate: isExam ? targetDate : null, userId }),
    isExam
      ? loadMockMinutes(goal)
      : {
          mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure: null }),
          shortMockMinutes: null,
        },
  ]);

  return { lessons, prerequisites, readiness, ...mocks };
}
