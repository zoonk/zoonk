"use server";

import { redirect } from "@/i18n/navigation";
import {
  getCurrentUserCoursePlan,
  updateCurrentUserCoursePlan,
} from "@zoonk/core/courses/learning-plan";
import { type CoursePlanInput } from "@zoonk/core/courses/learning-plan-contract";
import { safeAsync } from "@zoonk/utils/error";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";

export async function saveCoursePreferences(
  context: {
    courseId: string;
    expectedRevision: number;
    brandSlug: string;
    courseSlug: string;
    locale: string;
  },
  input: Pick<CoursePlanInput, "dailyMinutes" | "hiddenLessonKinds">,
) {
  const locale = getSupportedLocaleFromLanguage(context.locale);

  const { data: result, error } = await safeAsync(async () => {
    const current = await getCurrentUserCoursePlan({ courseId: context.courseId });

    if (current.status !== "ready" || !current.plan) {
      return { status: "unavailable" as const };
    }

    const { plan } = current;

    return updateCurrentUserCoursePlan({
      courseId: context.courseId,
      expectedRevision: context.expectedRevision,
      input: {
        dailyMinutes: input.dailyMinutes,
        depth: plan.depth,
        goal: plan.goal,
        hiddenLessonKinds: input.hiddenLessonKinds,
        startingKnowledge: plan.startingKnowledge,
        startingLevel: plan.startingLevel,
      },
    });
  });

  if (error || result.status === "unavailable") {
    return { error: "unavailable" as const };
  }

  if (result.status !== "ready") {
    return {
      error:
        result.status === "invalid" ||
        result.status === "conflict" ||
        result.status === "limitReached"
          ? result.status
          : ("unavailable" as const),
    };
  }

  return redirect({
    href: `/b/${context.brandSlug}/c/${context.courseSlug}?edition=original`,
    locale,
  });
}
