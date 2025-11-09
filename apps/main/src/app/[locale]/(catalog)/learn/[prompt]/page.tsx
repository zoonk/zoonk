"use cache";

import { cacheTagCourseSuggestions } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CourseSuggestions } from "./course-suggestions";
import { CourseSuggestionsFallback } from "./course-suggestions-fallback";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[prompt]">): Promise<Metadata> {
  cacheLife("max");

  const { locale, prompt: rawPrompt } = await params;
  const t = await getTranslations({ locale, namespace: "LearnResults" });
  const prompt = decodeURIComponent(rawPrompt);

  cacheTag(locale, cacheTagCourseSuggestions({ prompt }));

  return {
    description: t("metaDescription", { prompt }),
    title: t("metaTitle", { prompt }),
  };
}

export default async function Learn({
  params,
}: PageProps<"/[locale]/learn/[prompt]">) {
  cacheLife("max");
  const { locale, prompt: rawPrompt } = await params;
  setRequestLocale(locale);

  const prompt = decodeURIComponent(rawPrompt);
  cacheTag(locale, cacheTagCourseSuggestions({ prompt }));

  return (
    <Suspense fallback={<CourseSuggestionsFallback />}>
      <CourseSuggestions locale={locale} prompt={prompt} />
    </Suspense>
  );
}
