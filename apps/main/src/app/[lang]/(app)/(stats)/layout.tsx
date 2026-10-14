import { SectionPage } from "@/components/learn/section-page";
import { getMenu } from "@/lib/menu";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { StatsNav } from "./_components/stats-nav";

/** One learner's own numbers: nothing here is for search. */
export const metadata: Metadata = { robots: { follow: false, index: false } };

/**
 * Statistics are a section of the app: from a tablet up its title and its stats as tabs head
 * every stats page, which are as wide as a page (a dashboard); on phones the section's own bar is
 * the page's top. They open on the overview (every stat with its number, each opening its page),
 * and each stat's page goes back to it. Every number covers all of the learner's goals.
 */
export default async function StatsLayout({ children }: LayoutProps<"/[lang]">) {
  const t = await getExtracted();

  return (
    <SectionPage
      eyebrow={t("All goals")}
      hub={{ href: getMenu("stats").url, title: t("Statistics") }}
      nav={<StatsNav />}
    >
      {children}
    </SectionPage>
  );
}
