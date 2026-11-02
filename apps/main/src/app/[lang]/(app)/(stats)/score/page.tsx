import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { ScoreChartPreload } from "./score-chart-preload";
import { ScoreContent, ScoreContentSkeleton } from "./score-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("See your answer accuracy and weekly trend over the past 90 days."),
    title: t("Score"),
  };
}

export default async function ScorePage() {
  const t = await getExtracted();

  return (
    <StatsPage title={t("Score")}>
      <ScoreChartPreload />
      <Suspense fallback={<ScoreContentSkeleton />}>
        <ScoreContent />
      </Suspense>
    </StatsPage>
  );
}
