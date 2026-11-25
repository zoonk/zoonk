import "server-only";
import { prisma } from "@zoonk/db";
import { findCourseMaterialGoalIds, findLessonMaterialGoalIds } from "./goal-material";

export type MaterialReadingScope =
  | { kind: "course"; courseId: string }
  | { kind: "goal"; goalId: string }
  | { kind: "lesson"; lessonId: string }
  | { kind: "sources"; sourceIds: string[] };

async function findGoalIds(scope: Exclude<MaterialReadingScope, { kind: "sources" }>) {
  switch (scope.kind) {
    case "course": {
      const course = await prisma.course.findUnique({
        select: { id: true, userId: true, visibility: true },
        where: { id: scope.courseId },
      });

      return course ? findCourseMaterialGoalIds(course) : [];
    }
    case "goal":
      return [scope.goalId];
    case "lesson":
      return findLessonMaterialGoalIds(scope.lessonId);
    default:
      return scope satisfies never;
  }
}

/** The workflow's target or the caller's source IDs have already been authorized. */
export async function findOwedMaterialSourceIds(scope: MaterialReadingScope): Promise<string[]> {
  if (scope.kind === "sources" && scope.sourceIds.length === 0) {
    return [];
  }

  const target =
    scope.kind === "sources"
      ? { id: { in: scope.sourceIds } }
      : {
          goalSources: {
            some: { goalId: { in: await findGoalIds(scope) }, origin: "upload" as const },
          },
        };

  const sources = await prisma.source.findMany({
    select: { id: true },
    where: { ...target, readState: "owed" },
  });

  return sources.map(({ id }) => id);
}
