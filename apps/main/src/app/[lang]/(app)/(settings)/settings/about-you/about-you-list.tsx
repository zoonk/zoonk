import { SectionPageHeader } from "@/components/learn/section-page";
import { getAppLocale } from "@/i18n/locale";
import { getProfileQuestions } from "@zoonk/core/profile/questions/get";
import { firstOpenAboutYouQuestion } from "@zoonk/learn/about-you/order";
import { Page } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../../_components/protected-section";
import { AboutYouCurrentScreen } from "./about-you-split";

async function AboutYouContent() {
  const view = await getProfileQuestions({ locale: await getAppLocale() });

  return (
    <ProtectedSection allowGuests next="/settings/about-you">
      {view && (
        <AboutYouCurrentScreen fallback={firstOpenAboutYouQuestion(view)?.id ?? null} view={view} />
      )}
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

export async function AboutYouList() {
  const t = await getExtracted();

  return (
    <Page>
      <SectionPageHeader
        description={t("Your answers shape your examples and your buddy. Everything is optional.")}
        title={t("About you")}
      />

      <Suspense fallback={<AboutYouSkeleton />}>
        <AboutYouContent />
      </Suspense>
    </Page>
  );
}
