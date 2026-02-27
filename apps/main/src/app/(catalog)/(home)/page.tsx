import { getContinueLearning } from "@/data/courses/get-continue-learning";
import { getBeltLevel } from "@/data/progress/get-belt-level";
import { getBestDay } from "@/data/progress/get-best-day";
import { getBestTime } from "@/data/progress/get-best-time";
import { getEnergyLevel } from "@/data/progress/get-energy-level";
import { getScore } from "@/data/progress/get-score";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { HomeContent, HomeContentSkeleton } from "./home-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Zoonk is an AI-powered learning platform where you can learn anything through interactive courses, lessons, and activities.",
    ),
    title: { absolute: t("Zoonk: AI Learning Platform") },
  };
}

export default async function Home() {
  // Preload data for Suspense boundaries
  void Promise.all([
    getContinueLearning(),
    getEnergyLevel(),
    getBeltLevel(),
    getScore(),
    getBestDay(),
    getBestTime(),
  ]);

  return (
    <Suspense fallback={<HomeContentSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
