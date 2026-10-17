import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { parsePlanGraph } from "../../plans/planner/plan-state";

/**
 * A public exam course's own question bank identifies its blueprint when the exam graph opens
 * with another subject's course. Multiple exams using the same shared skills are ambiguous.
 */
async function findQuestionBankExam(course: Pick<Course, "format" | "id" | "language">) {
  if (course.format !== "exam") {
    return null;
  }

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
      language: course.language,
      ownerId: null,
      visibility: "public",
    },
  });

  const [blueprint] = blueprints;

  return blueprints.length === 1 && blueprint
    ? { blueprint, graph: parsePlanGraph(blueprint.skillGraph?.graph) }
    : null;
}

/** A course's stored public exam, linked by its curriculum or question bank, never by its title. */
export async function loadCourseExam(courseId: string) {
  const stored = await prisma.examSkillGraph.findFirst({
    include: { examBlueprint: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    where: { examBlueprint: { ownerId: null, visibility: "public" }, primaryCourseId: courseId },
  });

  if (stored) {
    return { blueprint: stored.examBlueprint, graph: parsePlanGraph(stored.graph) };
  }

  const course = await prisma.course.findFirst({
    omit: { landingPage: true },
    where: { id: courseId, visibility: "public" },
  });

  if (!course) {
    return null;
  }

  // The umbrella's primary link and each named subject's graph link express the same curriculum.
  const named = await prisma.examSkillGraph.findMany({
    include: { examBlueprint: true },
    take: 2,
    where: {
      examBlueprint: { language: course.language, ownerId: null, visibility: "public" },
      graph: { array_contains: [{ courseIds: [courseId] }], path: ["skills"] },
    },
  });

  const [graph] = named;

  if (named.length > 0) {
    return named.length === 1 && graph
      ? { blueprint: graph.examBlueprint, graph: parsePlanGraph(graph.graph) }
      : null;
  }

  return findQuestionBankExam(course);
}
