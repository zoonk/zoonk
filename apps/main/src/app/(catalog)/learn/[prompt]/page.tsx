import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CourseSuggestions } from "./course-suggestions";
import { CourseSuggestionsFallback } from "./course-suggestions-fallback";

export async function generateMetadata({
  params,
}: PageProps<"/learn/[prompt]">): Promise<Metadata> {
  const { prompt: rawPrompt } = await params;
  const t = await getExtracted();
  const prompt = decodeURIComponent(rawPrompt);

  return {
    description: t(
      "Discover personalized courses and resources to learn {prompt}. Zoonk uses AI to generate interactive lessons and activities tailored to you.",
      { prompt },
    ),
    title: t("Learn {prompt} with AI", { prompt }),
  };
}

export default async function Learn({ params }: PageProps<"/learn/[prompt]">) {
  const { prompt: rawPrompt } = await params;
  const prompt = decodeURIComponent(rawPrompt);

  return (
    <Suspense fallback={<CourseSuggestionsFallback />}>
      <CourseSuggestions prompt={prompt} />
    </Suspense>
  );
}
