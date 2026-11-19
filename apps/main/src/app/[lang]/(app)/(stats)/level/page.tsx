import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { LevelContent, LevelContentSkeleton } from "./level-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { description: t("Your belt, level and Brain Power."), title: t("Level") };
}

export default async function LevelPage() {
  const t = await getExtracted();

  return (
    <StatsPage title={t("Level")}>
      <Suspense fallback={<LevelContentSkeleton />}>
        <LevelContent />
      </Suspense>
    </StatsPage>
  );
}
