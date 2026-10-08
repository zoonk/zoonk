import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { EnergyContent, EnergyContentSkeleton } from "./energy-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { description: t("Your Energy now and over the past 12 months."), title: t("Energy") };
}

export default async function EnergyPage() {
  const t = await getExtracted();

  return (
    <StatsPage metric="energy" title={t("Energy")}>
      <Suspense fallback={<EnergyContentSkeleton />}>
        <EnergyContent />
      </Suspense>
    </StatsPage>
  );
}
