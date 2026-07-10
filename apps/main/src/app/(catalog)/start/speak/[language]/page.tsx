import { getAiCourseHref } from "@/data/courses/course-href";
import {
  getCompletedLanguageCourse,
  getOrCreateLanguageCoursePromptRequest,
} from "@/data/courses/language-course";
import { getLanguageName, isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { getLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

/**
 * Turns a selected supported language into either the existing completed course
 * or the controlled workflow input that will generate that course.
 */
export default async function StartSpeakLanguage({ params }: PageProps<"/start/speak/[language]">) {
  const { language: targetLanguage } = await params;

  if (!isTTSSupportedLanguage(targetLanguage)) {
    notFound();
  }

  const locale = await getLocale();

  if (targetLanguage === locale) {
    redirect("/start/speak");
  }

  const completedCourse = await getCompletedLanguageCourse({ language: locale, targetLanguage });

  if (completedCourse) {
    redirect(getAiCourseHref(completedCourse));
  }

  const title = getLanguageName({ targetLanguage, userLanguage: locale });

  const request = await getOrCreateLanguageCoursePromptRequest({
    language: locale,
    targetLanguage,
    title,
  });

  redirect(`/generate/course/${request.id}`);
}
