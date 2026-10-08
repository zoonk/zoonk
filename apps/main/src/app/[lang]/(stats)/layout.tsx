import { SectionFrame } from "@/components/learn/section-frame";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { getMenu } from "@/lib/menu";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { StatsNav } from "./_components/stats-nav";

/** One learner's own numbers: nothing here is for search. */
export const metadata: Metadata = { robots: { follow: false, index: false } };

/**
 * Statistics are a section: their own bar replaces the app's. They open on the overview (every stat
 * with its number, each opening its page); each stat's page goes back to it and, from `lg`, keeps
 * the stats in a sidebar beside it.
 */
export default async function StatsLayout({ children }: LayoutProps<"/[lang]">) {
  const t = await getExtracted();

  return (
    <ClientMessagesProvider scope="learn">
      <SectionFrame hub={{ href: getMenu("stats").url, nav: <StatsNav />, title: t("Statistics") }}>
        {children}
      </SectionFrame>
    </ClientMessagesProvider>
  );
}
