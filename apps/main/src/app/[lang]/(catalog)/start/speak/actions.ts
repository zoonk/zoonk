"use server";

import { getAiCourseHref } from "@/data/courses/course-href";
import { redirect } from "@/i18n/navigation";
import { resolveLanguageCourse } from "@zoonk/core/courses/language";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { isValidLocale } from "@zoonk/utils/locale";

/** Selecting a language explicitly authorizes resolving its reusable generation request. */
export async function startLanguageCourse(
  locale: string,
  _state: { error: boolean },
  formData: FormData,
) {
  const targetLanguage = formData.get("language");

  if (
    !isValidLocale(locale) ||
    typeof targetLanguage !== "string" ||
    !isTTSSupportedLanguage(targetLanguage) ||
    targetLanguage === locale
  ) {
    return { error: true };
  }

  let resolution: Awaited<ReturnType<typeof resolveLanguageCourse>>;

  try {
    resolution = await resolveLanguageCourse({ language: locale, targetLanguage });
  } catch {
    return { error: true };
  }

  if (resolution.kind === "unauthorized") {
    return redirect({
      href: `/login?next=${encodeURIComponent(`/start/speak/${targetLanguage}`)}`,
      locale,
    });
  }

  if (resolution.kind === "course") {
    return redirect({ href: `${getAiCourseHref(resolution.course)}/start`, locale });
  }

  return redirect({ href: `/generate/course/${resolution.coursePrompt.id}`, locale });
}
