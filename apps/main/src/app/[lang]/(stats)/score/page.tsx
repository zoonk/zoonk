import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { ScoreContent, ScoreContentSkeleton } from "./score-content";

/** Describes the fixed Score window consistently in browser and social metadata. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("See your answer accuracy and weekly trend over the past 90 days."),
    title: t("Score"),
  };
}

/** The rolling Score: its accuracy, weekly trend and one line, under Statistics. */
export default async function ScorePage() {
  const t = await getExtracted();

  return (
    <StatsPage metric="score" title={t("Score")}>
      <Suspense fallback={<ScoreContentSkeleton />}>
        <ScoreContent />
      </Suspense>
    </StatsPage>
  );
}
