import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { PatternsContent, PatternsContentSkeleton } from "./patterns-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("See when you perform best over the past 90 days."),
    title: t("Patterns"),
  };
}

export default async function PatternsPage() {
  const t = await getExtracted();

  return (
    <StatsPage
      description={t("When you answer best, over the last 90 days.")}
      title={t("Patterns")}
    >
      <Suspense fallback={<PatternsContentSkeleton />}>
        <PatternsContent />
      </Suspense>
    </StatsPage>
  );
}
