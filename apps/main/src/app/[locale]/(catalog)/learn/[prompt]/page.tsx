"use cache";

import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
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

  cacheTag(locale, prompt);

  return {
    title: t("metaTitle", { prompt }),
    description: t("metaDescription", { prompt }),
  };
}

export default async function Learn({
  params,
}: PageProps<"/[locale]/learn/[prompt]">) {
  cacheLife("max");
  const { locale, prompt: rawPrompt } = await params;
  setRequestLocale(locale);

  const prompt = decodeURIComponent(rawPrompt);
  cacheTag(locale, prompt);

  return (
    <Suspense fallback={<CourseSuggestionsFallback />}>
      <CourseSuggestions prompt={prompt} locale={locale} />
    </Suspense>
  );
}
