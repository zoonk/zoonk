import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CourseSuggestions } from "./course-suggestions";
import { CourseSuggestionsFallback } from "./course-suggestions-fallback";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[prompt]">): Promise<Metadata> {
  const { locale, prompt: rawPrompt } = await params;
  const t = await getExtracted({ locale });
  const prompt = decodeURIComponent(rawPrompt);

  return {
    description: t(
      "Discover personalized courses and resources to learn {prompt}. Zoonk uses AI to generate interactive lessons and activities tailored to you.",
      { prompt },
    ),
    title: t("Learn {prompt} with AI", { prompt }),
  };
}

export default async function Learn({ params }: PageProps<"/[locale]/learn/[prompt]">) {
  const { locale, prompt: rawPrompt } = await params;
  setRequestLocale(locale);

  const prompt = decodeURIComponent(rawPrompt);

  return (
    <Suspense fallback={<CourseSuggestionsFallback />}>
      <CourseSuggestions locale={locale} prompt={prompt} />
    </Suspense>
  );
}
