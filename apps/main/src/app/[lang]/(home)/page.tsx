import { UsageDataNotice } from "@/app/[lang]/usage-data-notice";
import { VisitorSummarySeed } from "@/components/learner/learner-summary-seed";
import { JsonLd } from "@/components/public/json-ld";
import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { PublicFooter } from "@/components/public/public-footer";
import { PUBLIC_FOOTER_ID } from "@/components/public/public-ids";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { StickyStartBar } from "@/components/public/sticky-start-bar";
import { Link, getPathname } from "@/i18n/navigation";
import { getLocalizedAlternates } from "@/lib/metadata/localized-url";
import { HOME_JSON_LD } from "@/lib/public/structured-data";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { FinalCall } from "./_components/final-call";
import { ForgetSection } from "./_components/forget-section";
import { HomeFaq } from "./_components/home-faq";
import { HomeHeader } from "./_components/home-header";
import { HomeHero } from "./_components/home-hero";
import { FINAL_GOAL_ID, HERO_GOAL_ID } from "./_components/home-ids";
import { MissedDaySection } from "./_components/missed-day-section";
import { ReadySection } from "./_components/ready-section";
import { StartSection } from "./_components/start-section";
import { StuckSection } from "./_components/stuck-section";

export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const language = await lang();

  return {
    alternates: getLocalizedAlternates({ href: "/", language }),
    description: t(
      "Tell Zoonk your goal and the date. It breaks everything into a daily plan that fits your time and starts from what you already know. Start free, no account needed.",
    ),
    title: {
      absolute: t({
        description:
          "The landing's title. In Brazilian Portuguese: “Zoonk: Pare de decidir o que estudar. Só estude.”",
        message: "Zoonk: Stop deciding what to study. Just study.",
      }),
    },
  };
}

/**
 * Every example variant is in the HTML and CSS shows the picked one, so the page has no script of its
 * own. Anyone with a session opens Today instead (`proxy.ts`).
 */
export default async function HomePage() {
  const t = await getExtracted();
  const language = await lang();
  const locale = getSupportedLocaleFromLanguage(language);
  const startPath = getPathname({ href: "/start", locale });

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd items={HOME_JSON_LD} />
      <PublicViewTracker page="home" />
      <VisitorSummarySeed />
      <UsageDataNotice className={PUBLIC_CONTAINER_CLASS} />
      <HomeHeader />

      <main className="flex-1">
        <HomeHero startPath={startPath} />
        <StartSection />
        <MissedDaySection />
        <ForgetSection />
        <StuckSection />
        <ReadySection />
        <HomeFaq />
        <FinalCall startPath={startPath} />
      </main>

      <PublicFooter pathname="/" />

      <StickyStartBar
        afterId={HERO_GOAL_ID}
        hideWhileVisibleIds={[FINAL_GOAL_ID, PUBLIC_FOOTER_ID]}
      >
        <Link className={cn(buttonVariants({ size: "lg" }), "w-full")} href="/start">
          {t("Start free")}
        </Link>
      </StickyStartBar>
    </div>
  );
}
