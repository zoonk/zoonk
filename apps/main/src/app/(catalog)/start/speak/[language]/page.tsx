import {
  getCompletedLanguageCourse,
  getLanguageCourseHref,
  getOrCreateLanguageCourseSuggestion,
} from "@/data/courses/language-course";
import { getLanguageName, isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { getExtracted, getLocale } from "next-intl/server";
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
    redirect(getLanguageCourseHref(completedCourse));
  }

  const t = await getExtracted();
  const title = getLanguageName({ targetLanguage, userLanguage: locale });

  const description = t(
    "Learn {language} from scratch with practical vocabulary, pronunciation, grammar, and listening practice.",
    { language: title },
  );

  const suggestion = await getOrCreateLanguageCourseSuggestion({
    description,
    language: locale,
    targetLanguage,
    title,
  });

  redirect(`/generate/cs/${suggestion.id}`);
}
