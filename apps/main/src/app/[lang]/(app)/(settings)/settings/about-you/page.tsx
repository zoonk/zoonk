import { SectionPageHeader } from "@/components/learn/section-page";
import { getAppLocale } from "@/i18n/locale";
import { getProfileQuestions } from "@zoonk/core/profile/questions/get";
import { AboutYouScreen } from "@zoonk/learn/about-you";
import { Page } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../../_components/protected-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Your answers shape your examples and your buddy. Everything is optional."),
    robots: { follow: false, index: false },
    title: t("About you"),
  };
}

async function AboutYouContent() {
  const view = await getProfileQuestions({ locale: await getAppLocale() });

  return (
    <ProtectedSection allowGuests next="/settings/about-you">
      {view && <AboutYouScreen view={view} />}
    </ProtectedSection>
  );
}

function AboutYouSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      {["h-33", "h-55", "h-22"].map((height) => (
        <div className="flex flex-col gap-3" key={height}>
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className={`${height} rounded-lg`} />
        </div>
      ))}
    </div>
  );
}

export default async function AboutYouPage() {
  const t = await getExtracted();

  return (
    <Page measure="form">
      <SectionPageHeader title={t("About you")} />

      <p className="text-muted-foreground -mt-4 text-sm text-pretty md:mt-0">
        {t("Your answers shape your examples and your buddy. Everything is optional.")}
      </p>

      <Suspense fallback={<AboutYouSkeleton />}>
        <AboutYouContent />
      </Suspense>
    </Page>
  );
}
