import { SectionPage } from "@/components/learn/section-page";
import { LearnerClock } from "@/components/learner/learner-clock";
import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";
import { getMenu } from "@/lib/menu";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { StatsNav } from "./_components/stats-nav";

export const metadata: Metadata = { robots: { follow: false, index: false } };

export default async function StatsLayout({ children }: LayoutProps<"/[lang]">) {
  const t = await getExtracted();

  return (
    <>
      <SectionPage
        hub={{ href: getMenu("stats").url, title: t("Statistics") }}
        measure="list"
        nav={<StatsNav />}
      >
        <LearnerClock>{children}</LearnerClock>
      </SectionPage>
      <LearnerSummarySeed />
    </>
  );
}
