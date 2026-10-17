import { isJsonObject } from "@zoonk/utils/json";
import { type ExamSkillGraph } from "../../generated/prisma/client";

export function getExamCourseLink({
  courseId,
  graph,
}: {
  courseId: string;
  graph: Pick<ExamSkillGraph, "id" | "primaryCourseId"> | null;
}) {
  return graph
    ? {
        currentPrimaryCourseId: graph.primaryCourseId,
        graphId: graph.id,
        nextPrimaryCourseId: courseId,
      }
    : null;
}

/** Recognize only the reviewed old link or its already-applied exact target, never a third link. */
export function getReviewedLinkFingerprint<
  Graph extends Pick<ExamSkillGraph, "id" | "primaryCourseId">,
>({
  courseId,
  graph,
  reviewed,
}: {
  courseId: string;
  graph: Graph | null;
  reviewed: unknown;
}): Graph | null {
  if (reviewed === undefined) {
    return graph;
  }

  if (graph === null && reviewed === null) {
    return null;
  }

  if (
    !graph ||
    !isJsonObject(reviewed) ||
    reviewed.graphId !== graph.id ||
    reviewed.nextPrimaryCourseId !== courseId ||
    (reviewed.currentPrimaryCourseId !== null &&
      typeof reviewed.currentPrimaryCourseId !== "string")
  ) {
    throw new Error("Exam course link changed since review; refusing repair");
  }

  if (
    graph.primaryCourseId !== reviewed.currentPrimaryCourseId &&
    graph.primaryCourseId !== courseId
  ) {
    throw new Error("Exam course link changed since review; refusing repair");
  }

  return { ...graph, primaryCourseId: reviewed.currentPrimaryCourseId };
}
