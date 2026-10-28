import { JsonLd } from "@/components/public/json-ld";
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
import { HomeExample } from "./_components/hero-window";
import { HomeHeader } from "./_components/home-header";
import { HomeHero } from "./_components/home-hero";
import { FINAL_GOAL_ID, HERO_GOAL_ID } from "./_components/home-ids";
import { StopBuddy } from "./_components/stop-buddy";
import { StopDayOne } from "./_components/stop-day-one";
import { StopEveryDay } from "./_components/stop-every-day";
import { StopPractice } from "./_components/stop-practice";

export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const language = await lang();

  return {
    alternates: getLocalizedAlternates({ href: "/", language }),
    description: t(
      "Tell Zoonk your goal and date, like an exam or a move abroad. Get a study plan for every day that fits your schedule. Start free, no account needed.",
    ),
    title: { absolute: t("Zoonk: A study plan for every day until the big day") },
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
      <HomeHeader />

      <main className="flex-1">
        <HomeHero startPath={startPath} />
        <HomeExample />

        <div>
          <StopDayOne />
          <StopEveryDay />
          <StopPractice />
          <StopBuddy />
          <FinalCall startPath={startPath} />
        </div>
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
