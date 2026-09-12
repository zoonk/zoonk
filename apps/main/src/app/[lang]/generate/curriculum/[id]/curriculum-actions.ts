"use server";

import { getLearningTargetHref } from "@/data/courses/learning-target-href";
import { startCurrentUserCourse } from "@zoonk/core/courses/learning-plan";
import { getCourseCurriculumGenerationView } from "@zoonk/core/workflows/course-curriculum-generation-access";

export async function readCurriculumGeneration(courseId: string) {
  const view = await getCourseCurriculumGenerationView({ courseId });

  if (view.status !== "ready") {
    return { status: "unavailable" as const };
  }

  return {
    generationRunId: view.course.generationRunId,
    generationStatus: view.course.generationStatus,
    status: view.needsGeneration ? ("pending" as const) : ("completed" as const),
  };
}

export async function finishCurriculumSetup(courseId: string) {
  const view = await getCourseCurriculumGenerationView({ courseId });

  if (view.status !== "ready" || view.needsGeneration) {
    return { status: "unavailable" as const };
  }

  const result = await startCurrentUserCourse({ courseId });

  if (result.status !== "ready") {
    return { status: "unavailable" as const };
  }

  const brandSlug = view.course.userId ? "me" : "ai";

  return {
    href: result.nextTarget
      ? getLearningTargetHref(result.nextTarget)
      : (`/b/${brandSlug}/c/${view.course.slug}?edition=original` as const),
    status: "ready" as const,
  };
}
