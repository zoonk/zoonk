import { SectionPage } from "@/components/learn/section-page";
import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";
import { getMenu } from "@/lib/menu";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { StatsNav } from "./_components/stats-nav";

export const metadata: Metadata = { robots: { follow: false, index: false } };

/** Every number covers all of the learner's goals. */
export default async function StatsLayout({ children }: LayoutProps<"/[lang]">) {
  const t = await getExtracted();

  return (
    <>
      <SectionPage
        eyebrow={t("All goals")}
        hub={{ href: getMenu("stats").url, title: t("Statistics") }}
        nav={<StatsNav />}
      >
        {children}
      </SectionPage>
      <LearnerSummarySeed />
    </>
  );
}
