import type { Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { getContinueLearning } from "@/data/courses/get-continue-learning";
import { getEnergyLevel } from "@/data/progress/get-energy-level";
import {
  ContinueLearning,
  ContinueLearningSkeleton,
} from "./continue-learning";
import { Performance, PerformanceSkeleton } from "./performance";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Zoonk is an AI-powered learning platform where you can learn anything through interactive courses, lessons, and activities.",
    ),
    title: { absolute: t("Zoonk: AI Learning Platform") },
  };
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // preload data
  void Promise.all([getContinueLearning(), getEnergyLevel()]);

  return (
    <>
      <Suspense fallback={<ContinueLearningSkeleton />}>
        <ContinueLearning />
      </Suspense>

      <Suspense fallback={<PerformanceSkeleton />}>
        <Performance />
      </Suspense>
    </>
  );
}
