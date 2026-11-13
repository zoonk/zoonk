import { UsageDataNotice } from "@/app/[lang]/usage-data-notice";
import { VisitorSummarySeed } from "@/components/learner/learner-summary-seed";
import { JsonLd } from "@/components/public/json-ld";
import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { StickyStartBar } from "@/components/public/page-start";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { Link, getPathname } from "@/i18n/navigation";
import { getLocalizedAlternates } from "@/lib/metadata/localized-url";
import { HOME_JSON_LD } from "@/lib/public/structured-data";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { CareerSection } from "./_components/career-section";
import { EveryPlan } from "./_components/every-plan";
import { ExamSection } from "./_components/exam-section";
import { FinalCall } from "./_components/final-call";
import { HomeFaq } from "./_components/home-faq";
import { HomeHeader } from "./_components/home-header";
import { HomeHero } from "./_components/home-hero";
import { LanguageSection } from "./_components/language-section";
import { TopicSection } from "./_components/topic-section";

export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const language = await lang();

  return {
    alternates: getLocalizedAlternates({ href: "/", language }),
    description: t({
      description:
        "The landing's description for search results. In Brazilian Portuguese: “Conte seu objetivo e a data. O Zoonk monta um plano de estudos para cada dia, do tamanho do seu tempo, começando pelo que você já sabe. Comece grátis, sem precisar de conta.”",
      message:
        "Tell Zoonk your goal and the date. It builds a study plan for each day that fits your time and starts from what you already know. Start free, no account needed.",
    }),
    title: {
      absolute: t({
        description:
          "The landing's title. In Brazilian Portuguese: “Zoonk: um plano de estudos para cada dia até o seu objetivo”.",
        message: "Zoonk: A study plan for each day, all the way to your goal",
      }),
    },
  };
}

/** Anyone with a session opens Today instead (`proxy.ts`). */
export default async function HomePage() {
  const t = await getExtracted();
  const language = await lang();
  const locale = getSupportedLocaleFromLanguage(language);
  const startPath = getPathname({ href: "/start", locale });

  // Clipped like every public page, so the bar's last button doesn't scroll the page sideways.
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <JsonLd items={HOME_JSON_LD} />
      <PublicViewTracker page="home" />
      <VisitorSummarySeed />
      <UsageDataNotice className={PUBLIC_CONTAINER_CLASS} />
      <HomeHeader />

      <main className="flex-1 [&:lang(ja)]:[word-break:auto-phrase]">
        <HomeHero startPath={startPath} />
        <ExamSection />
        <LanguageSection />
        <CareerSection />
        <TopicSection />
        <EveryPlan />
        <HomeFaq />
        <FinalCall startPath={startPath} />
      </main>

      <PublicFooter pathname="/" />

      <StickyStartBar className="sm:hidden">
        <Link className={cn(buttonVariants({ size: "lg" }), "w-full")} href="/start">
          {t("Build my plan")}
        </Link>
      </StickyStartBar>
    </div>
  );
}
