import { PublicFooter } from "@/components/public/public-footer";
import { PUBLIC_FOOTER_ID } from "@/components/public/public-ids";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { StickyStartBar } from "@/components/public/sticky-start-bar";
import { Link, getPathname } from "@/i18n/navigation";
import { getLocalizedAlternates } from "@/lib/metadata/localized-url";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { FinalCall } from "./_components/final-call";
import { HardPartSection } from "./_components/hard-part-section";
import { HomeExploreLinks } from "./_components/home-explore-links";
import { HomeHeader } from "./_components/home-header";
import { HomeHero } from "./_components/home-hero";
import { FINAL_GOAL_ID, HERO_GOAL_ID } from "./_components/home-ids";
import { ModesSection } from "./_components/modes-section";
import { PracticeSection } from "./_components/practice-section";

export async function generateMetadata(): Promise<Metadata> {
  const [language, t] = await Promise.all([lang(), getExtracted()]);

  return {
    alternates: getLocalizedAlternates({ href: "/", language }),
    description: t(
      "Write your goal in your own words. Zoonk plans every day until your date, with lessons, reviews and practice shaped by your goal. Free to start.",
    ),
    title: { absolute: t("Zoonk: Get ready for your exam, new job or move") },
  };
}

/**
 * The home page for visitors, prerendered per language. It has one job: get
 * someone started on a goal. Signed-in learners never render it; the proxy
 * sends them to Today first. The language comes from the root parameter,
 * which stays available while a prefetch warms the page's caches.
 */
export default async function HomePage() {
  const [language, t] = await Promise.all([lang(), getExtracted()]);
  const locale = getSupportedLocaleFromLanguage(language);
  const startPath = getPathname({ href: "/start", locale });

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicViewTracker page="home" />
      <HomeHeader />

      <main className="flex-1">
        <HomeHero startPath={startPath} />
        <PracticeSection locale={locale} />
        <HardPartSection />
        <ModesSection locale={locale} />
        <FinalCall startPath={startPath} />
      </main>

      <PublicFooter>
        <HomeExploreLinks locale={locale} />
      </PublicFooter>

      <StickyStartBar
        afterId={HERO_GOAL_ID}
        hideWhileVisibleIds={[FINAL_GOAL_ID, PUBLIC_FOOTER_ID]}
      >
        <Link className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")} href="/start">
          {t("Start")}
        </Link>
      </StickyStartBar>
    </div>
  );
}
