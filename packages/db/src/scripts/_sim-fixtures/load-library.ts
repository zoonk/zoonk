import { type TransactionClient } from "../../index";
import { type Graph, type GraphSkill, readGraph } from "./read-graph";
import { type FixtureSource } from "./sources";

/** The goal a fixture comes from, and the exam graph it plans from (the Library's, else its plan's). */
export async function loadGoalSource(
  tx: TransactionClient,
  where: FixtureSource & { kind: "goal" },
) {
  const goals = await tx.goal.findMany({
    include: { examBlueprint: { include: { skillGraph: true } }, plan: true },
    orderBy: { createdAt: "desc" },
    where: { ...where.goal, plan: { isNot: null } },
  });

  const goal = goals.find((entry) => readGraph(entry.plan?.graph).skills.length > 0);

  if (!goal) {
    throw new Error(`No goal with a planned graph for ${where.name}`);
  }

  const libraryGraph = goal.examBlueprint?.skillGraph?.graph;

  return {
    blueprint: goal.examBlueprint,
    goal,
    graph: readGraph(libraryGraph ?? goal.plan?.graph),
    graphSource: libraryGraph ? "exam_skill_graphs" : "a goal's plan",
  };
}

/** A career graph from courses: each course's tagged skills in course order, one phase per group. */
export async function buildCourseGraph(
  tx: TransactionClient,
  source: FixtureSource & { kind: "courses" },
): Promise<Graph> {
  const titles = source.phases.flatMap((phase) => phase.courses);

  const placements = await tx.courseChapter.findMany({
    include: {
      chapter: {
        include: {
          _count: { select: { lessons: true } },
          goalSkills: { include: { skill: true } },
        },
      },
      course: true,
    },
    orderBy: [{ position: "asc" }],
    where: { course: { language: source.language, title: { in: titles }, visibility: "public" } },
  });

  const seen = new Set<string>();

  const skills = source.phases.flatMap((phase, index) =>
    phase.courses.flatMap((title) =>
      placements
        .filter((placement) => placement.course.title === title)
        .flatMap((placement) =>
          placement.chapter.goalSkills.flatMap(({ skill }): GraphSkill[] => {
            if (seen.has(skill.id)) {
              return [];
            }

            seen.add(skill.id);

            return [
              {
                area: title,
                courseIds: [placement.courseId],
                lessons: Math.max(1, placement.chapter._count.lessons),
                name: skill.name,
                ...(phase.outcome && { outcome: true }),
                phase: index,
                skillId: skill.id,
                weight: null,
              },
            ];
          }),
        ),
    ),
  );

  return { phases: source.phases.map((phase) => ({ milestone: null, name: phase.name })), skills };
}

/** The chapters a graph's skills plan from: tagged with them, or holding a lesson that teaches them. */
function loadChapters(tx: TransactionClient, skillIds: string[]) {
  return tx.chapter.findMany({
    include: {
      courses: {
        orderBy: [{ createdAt: "asc" }, { courseId: "asc" }],
        where: { course: { visibility: "public" } },
      },
      goalSkills: { where: { skillId: { in: skillIds } } },
      lessons: { orderBy: { position: "asc" }, where: { lesson: { visibility: "public" } } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: {
      OR: [
        { goalSkills: { some: { skillId: { in: skillIds } } } },
        { lessons: { some: { lesson: { skills: { some: { skillId: { in: skillIds } } } } } } },
      ],
      visibility: "public",
    },
  });
}

/** The Library rows a graph's skills plan from, as the planner's loaders read them. */
export async function loadLibrary({
  graph,
  primaryCourseId,
  tx,
}: {
  graph: Graph;
  primaryCourseId: string | null;
  tx: TransactionClient;
}) {
  const skillIds = graph.skills.map((skill) => skill.skillId);
  const chapters = await loadChapters(tx, skillIds);

  // One query at a time: a transaction holds one connection.
  const lessonSkills = await tx.lessonSkill.findMany({
    orderBy: [{ lessonId: "asc" }, { skillId: "asc" }],
    where: { lesson: { visibility: "public" }, skillId: { in: skillIds } },
  });

  const prerequisites = await tx.skillPrerequisite.findMany({
    orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
    where: { prerequisiteId: { in: skillIds }, skillId: { in: skillIds } },
  });

  const skillRows = await tx.skill.findMany({
    select: { id: true, level: true },
    where: { id: { in: skillIds } },
  });

  const lessonIds = [
    ...new Set([
      ...chapters.flatMap((chapter) => chapter.lessons.map((entry) => entry.lessonId)),
      ...lessonSkills.map((row) => row.lessonId),
    ]),
  ];

  const courseIds = [
    ...new Set([
      ...chapters.flatMap((chapter) => chapter.courses.map((placement) => placement.courseId)),
      ...graph.skills.flatMap((skill) => skill.courseIds ?? []),
      ...(primaryCourseId ? [primaryCourseId] : []),
    ]),
  ];

  const lessons = await tx.lesson.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { id: { in: lessonIds } },
  });

  const courses = await tx.course.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { id: { in: courseIds } },
  });

  return { chapters, courses, lessonSkills, lessons, prerequisites, skillRows };
}
