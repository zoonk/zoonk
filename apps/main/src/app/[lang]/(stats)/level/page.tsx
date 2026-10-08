import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { LevelContent, LevelContentSkeleton } from "./level-content";

/** Keeps the browser description focused on the learner's current milestone. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { description: t("Your belt, level and Brain Power."), title: t("Level") };
}

/** Renders the focused Level shell while the authenticated progress streams in. */
export default async function LevelPage() {
  const t = await getExtracted();

  return (
    <StatsPage metric="level" title={t("Level")}>
      <Suspense fallback={<LevelContentSkeleton />}>
        <LevelContent />
      </Suspense>
    </StatsPage>
  );
}
