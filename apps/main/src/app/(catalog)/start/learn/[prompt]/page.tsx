import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CourseStartFallback } from "./course-start-fallback";
import { CourseStartResult } from "./course-start-result";

export async function generateMetadata({
  params,
}: PageProps<"/start/learn/[prompt]">): Promise<Metadata> {
  const { prompt: rawPrompt } = await params;
  const t = await getExtracted();
  const prompt = decodeURIComponent(rawPrompt);

  return {
    description: t(
      "Discover personalized courses and resources to learn {prompt}. Zoonk uses AI to create interactive lessons tailored to you.",
      { prompt },
    ),
    title: t("Learn {prompt} with AI", { prompt }),
  };
}

export default async function Learn({ params }: PageProps<"/start/learn/[prompt]">) {
  const { prompt: rawPrompt } = await params;
  const prompt = decodeURIComponent(rawPrompt);

  return (
    <Suspense fallback={<CourseStartFallback />}>
      <CourseStartResult prompt={prompt} />
    </Suspense>
  );
}
