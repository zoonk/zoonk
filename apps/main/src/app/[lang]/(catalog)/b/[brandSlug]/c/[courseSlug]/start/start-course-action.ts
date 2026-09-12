"use server";

import { getLearningTargetHref } from "@/data/courses/learning-target-href";
import { getPathname, redirect } from "@/i18n/navigation";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import {
  getCourseLearningPath,
  getCurrentUserCoursePlan,
  startCurrentUserCourse,
} from "@zoonk/core/courses/learning-plan";
import { coursePlanInputSchema } from "@zoonk/core/courses/learning-plan-contract";
import { type CourseLearningPlan } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";

export async function startCourseAction(
  context: {
    brandSlug: string;
    courseSlug: string;
    courseId: string;
    expectedRevision: number;
    locale: string;
  },
  formData: FormData,
) {
  const locale = getSupportedLocaleFromLanguage(context.locale);

  const [course, current] = await Promise.all([
    getCourse({ brandSlug: context.brandSlug, courseSlug: context.courseSlug }),
    getCurrentUserCoursePlan({ courseId: context.courseId }),
  ]);

  if (!course || course.id !== context.courseId) {
    return { error: "unavailable" as const };
  }

  const plan = current.status === "ready" ? current.plan : null;
  const parsed = parseSetupInput({ formData, format: course.format, plan });

  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  if (current.status === "unauthorized") {
    const preview = await getCourseLearningPath({ courseId: course.id, preferences: parsed.data });

    if (
      parsed.data.depth !== "focused" &&
      preview.status === "ready" &&
      preview.nextTarget?.generationStatus === "completed"
    ) {
      redirect({ href: getLearningTargetHref(preview.nextTarget), locale });
    }

    const next = getPathname({
      href: `/b/${context.brandSlug}/c/${context.courseSlug}/start`,
      locale,
    });

    redirect({ href: `/login?next=${encodeURIComponent(next)}`, locale });
  }

  const { data: result, error } = await safeAsync(() =>
    startCurrentUserCourse({
      courseId: course.id,
      expectedRevision: context.expectedRevision,
      input: parsed.data,
    }),
  );

  if (error) {
    return { error: "unavailable" as const };
  }

  if (result.status === "limitReached") {
    return { error: "limitReached" as const };
  }

  if (result.status === "generationRequired") {
    redirect({ href: `/generate/curriculum/${result.courseId}`, locale });
  }

  if (result.status === "ready") {
    redirect({
      href: result.nextTarget
        ? getLearningTargetHref(result.nextTarget)
        : `/b/${context.brandSlug}/c/${context.courseSlug}?edition=original`,
      locale,
    });
  }

  return { error: result.status === "conflict" ? ("conflict" as const) : ("unavailable" as const) };
}

function parseSetupInput({
  format,
  formData,
  plan,
}: {
  format: string;
  formData: FormData;
  plan: CourseLearningPlan | null;
}) {
  const depth = format === "language" ? "complete" : formData.get("depth");
  const level = formData.get("startingLevel");
  const defaultLevel = format === "language" ? "a1" : "basic";
  const startingLevel = level === "unsure" ? defaultLevel : level;

  return coursePlanInputSchema.safeParse({
    dailyMinutes: plan?.dailyMinutes,
    depth,
    goal: depth === "focused" ? formData.get("goal") : null,
    hiddenLessonKinds: plan?.hiddenLessonKinds,
    startingKnowledge: plan?.startingKnowledge,
    startingLevel: depth === "overview" ? "overview" : startingLevel || null,
  });
}
