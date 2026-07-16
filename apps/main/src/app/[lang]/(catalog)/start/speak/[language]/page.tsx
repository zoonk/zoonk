import { getAiCourseHref } from "@/data/courses/course-href";
import {
  getCompletedLanguageCourse,
  getOrCreateLanguageCoursePromptRequest,
} from "@/data/courses/language-course";
import { redirect } from "@/i18n/navigation";
import { getLanguageName, isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { notFound } from "next/navigation";

/**
 * Turns a selected supported language into either the existing completed course
 * or the controlled workflow input that will generate that course.
 */
export default async function StartSpeakLanguage({
  params,
}: PageProps<"/[lang]/start/speak/[language]">) {
  const { lang: locale, language: targetLanguage } = await params;

  if (!isTTSSupportedLanguage(targetLanguage)) {
    notFound();
  }

  if (targetLanguage === locale) {
    return redirect({ href: "/start/speak", locale });
  }

  const completedCourse = await getCompletedLanguageCourse({ language: locale, targetLanguage });

  if (completedCourse) {
    return redirect({ href: getAiCourseHref(completedCourse), locale });
  }

  const title = getLanguageName({ targetLanguage, userLanguage: locale });

  const request = await getOrCreateLanguageCoursePromptRequest({
    language: locale,
    targetLanguage,
    title,
  });

  return redirect({ href: `/generate/course/${request.id}`, locale });
}
