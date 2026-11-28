import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { parsePlanGraph } from "../../plans/planner/plan-state";

const PUBLIC_EXAM = { ownerId: null, visibility: "public" } as const;

async function findQuestionBankExam(course: Pick<Course, "id" | "language">) {
  const chapter = { courses: { some: { courseId: course.id } }, visibility: "public" as const };

  const blueprints = await prisma.examBlueprint.findMany({
    include: { skillGraph: true },
    take: 2,
    where: {
      items: {
        some: {
          skill: {
            OR: [
              { chapters: { some: { chapter } } },
              {
                lessons: {
                  some: {
                    lesson: {
                      chapters: { some: { chapter } },
                      setAsideAt: null,
                      visibility: "public",
                    },
                  },
                },
              },
            ],
            visibility: "public",
          },
        },
      },
      ...PUBLIC_EXAM,
      language: course.language,
    },
  });

  const [blueprint] = blueprints;

  return blueprints.length === 1 && blueprint
    ? { blueprint, graph: parsePlanGraph(blueprint.skillGraph?.graph) }
    : null;
}

/**
 * Only a course made for the whole exam is that exam's course; a subject course an exam reuses
 * stays a course of its own. The exam that owns the course comes first, then an exam whose graph
 * names it, then its question bank; never its title.
 */
export async function loadCourseExam(courseId: string) {
  const course = await prisma.course.findFirst({
    omit: { landingPage: true },
    where: { format: "exam", id: courseId, visibility: "public" },
  });

  if (!course) {
    return null;
  }

  const owners = await prisma.examSkillGraph.findMany({
    include: { examBlueprint: true },
    take: 2,
    where: { examBlueprint: PUBLIC_EXAM, primaryCourseId: courseId },
  });

  const linked =
    owners.length > 0
      ? owners
      : await prisma.examSkillGraph.findMany({
          include: { examBlueprint: true },
          take: 2,
          where: {
            examBlueprint: { ...PUBLIC_EXAM, language: course.language },
            graph: { array_contains: [{ courseIds: [courseId] }], path: ["skills"] },
          },
        });

  const [graph] = linked;

  if (linked.length > 0) {
    return linked.length === 1 && graph
      ? { blueprint: graph.examBlueprint, graph: parsePlanGraph(graph.graph) }
      : null;
  }

  return findQuestionBankExam(course);
}
