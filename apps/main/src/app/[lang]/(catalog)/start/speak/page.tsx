import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import {
  StartSurface,
  StartSurfaceContent,
  StartSurfaceHeader,
  StartSurfaceTitle,
} from "../_components/start-surface";
import { LanguageListContent, LanguageListSkeleton } from "./language-list-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Online language courses with AI. Learn a language with pronunciation tips, vocabulary, reading, and listening practice.",
    ),
    title: t("Learn a language online with AI"),
  };
}

/**
 * Shows every TTS-supported language as a searchable list so learners can start
 * a controlled language course without going through open-ended prompting.
 */
export default async function StartSpeak({ params }: PageProps<"/[lang]/start/speak">) {
  const t = await getExtracted();

  return (
    <StartSurface>
      <StartSurfaceHeader>
        <StartSurfaceContent>
          <StartSurfaceTitle>{t("What language do you want to learn?")}</StartSurfaceTitle>
        </StartSurfaceContent>
      </StartSurfaceHeader>

      <Suspense fallback={<LanguageListSkeleton />}>
        <LanguageListContent params={params} />
      </Suspense>
    </StartSurface>
  );
}
