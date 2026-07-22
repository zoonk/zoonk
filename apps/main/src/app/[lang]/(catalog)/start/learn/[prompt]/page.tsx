import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CourseStartResult } from "./course-prompt-result";
import { CourseStartFallback } from "./course-start-fallback";

export const prefetch = "force-disabled";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/start/learn/[prompt]">): Promise<Metadata> {
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

/**
 * Resolves and decodes the prompt inside the existing decision-state fallback
 * so the route no longer needs a segment-wide loading file.
 */
async function LearnContent({ params }: Pick<PageProps<"/[lang]/start/learn/[prompt]">, "params">) {
  const { prompt: rawPrompt } = await params;
  const prompt = decodeURIComponent(rawPrompt);

  return <CourseStartResult prompt={prompt} />;
}

export default function Learn(props: PageProps<"/[lang]/start/learn/[prompt]">) {
  return (
    <Suspense fallback={<CourseStartFallback />}>
      <LearnContent params={props.params} />
    </Suspense>
  );
}
