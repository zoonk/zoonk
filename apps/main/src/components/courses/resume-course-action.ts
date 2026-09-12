"use server";

import { getLearningTargetHref } from "@/data/courses/learning-target-href";
import { redirect } from "@/i18n/navigation";
import { startCurrentUserCourse } from "@zoonk/core/courses/learning-plan";
import { safeAsync } from "@zoonk/utils/error";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";

export async function resumeCourse({ courseId, language }: { courseId: string; language: string }) {
  const locale = getSupportedLocaleFromLanguage(language);
  const { data: result, error } = await safeAsync(() => startCurrentUserCourse({ courseId }));

  if (error) {
    return { status: "unavailable" as const };
  }

  if (result.status === "generationRequired") {
    return redirect({ href: `/generate/curriculum/${courseId}`, locale });
  }

  if (result.status === "ready" && result.nextTarget) {
    return redirect({ href: getLearningTargetHref(result.nextTarget), locale });
  }

  return { status: result.status === "ready" ? ("completed" as const) : result.status };
}
