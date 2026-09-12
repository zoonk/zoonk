"use server";

import { redirect } from "@/i18n/navigation";
import { resolveLearningRequest } from "@zoonk/core/courses/learning-request";
import { safeAsync } from "@zoonk/utils/error";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";

export async function learningRequestAction({
  prompt,
  language,
}: {
  prompt: string;
  language: string;
}) {
  const locale = getSupportedLocaleFromLanguage(language);

  const { data: result, error } = await safeAsync(() =>
    resolveLearningRequest({ language: locale, prompt }),
  );

  if (error) {
    return { status: "unavailable" as const };
  }

  if (result.kind === "course") {
    const href = `/b/${result.course.brandSlug}/c/${result.course.slug}` as const;
    return redirect({ href: result.course.format === "question" ? href : `${href}/start`, locale });
  }

  if (result.kind === "generate") {
    return redirect({ href: `/generate/course/${result.prompt.id}`, locale });
  }

  if (result.kind === "discovery") {
    return redirect({ href: `/start/discovery/${result.discoveryId}`, locale });
  }

  if (result.kind === "track") {
    return redirect({ href: `/tracks/${result.trackId}`, locale });
  }

  if (result.kind === "exam") {
    return redirect({ href: "/start/exam", locale });
  }

  return { status: result.kind };
}
