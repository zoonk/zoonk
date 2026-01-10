import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Suggestion } from "@/data/courses/course-suggestions";
import { getCourseSuggestionById } from "@/data/courses/get-course-suggestion";
import { GenerateCourseForm } from "./generate-course-form";

export default async function GeneratePage({
  params,
  searchParams,
}: PageProps<"/[locale]/generate/cs/[courseSuggestionId]">) {
  const { locale, courseSuggestionId } = await params;
  const { title } = await searchParams;
  setRequestLocale(locale);

  // 1. Validate suggestion exists
  const suggestion = await getCourseSuggestionById(Number(courseSuggestionId));
  if (!suggestion) {
    notFound();
  }

  // 2. Validate title matches one of the suggestions
  const suggestions = suggestion.suggestions as Suggestion[];
  const matchingSuggestion = suggestions.find((s) => s.title === title);
  if (!matchingSuggestion) {
    notFound();
  }

  // 3. Render generation UI - the form will handle course creation/redirect
  return (
    <GenerateCourseForm
      courseSuggestionId={Number(courseSuggestionId)}
      description={matchingSuggestion.description}
      locale={locale}
      title={matchingSuggestion.title}
    />
  );
}
