import { type GuardianLinkView } from "@zoonk/core/minors/guardian/contract";
import { listGuardianLinks } from "@zoonk/core/minors/guardian/list-links";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getEnergyLevel } from "@zoonk/core/progress/get-energy-level";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { AppearanceSettings } from "./appearance-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Choose your buddy, sounds, a daily time limit and the app's language."),
    robots: { follow: false, index: false },
    title: t("Appearance"),
  };
}

/** The shortest daily limit an active guardian set, if any. */
function getGuardianLimitMinutes(links: GuardianLinkView[] | null): number | null {
  const limits = (links ?? []).flatMap((link) =>
    link.status === "active" && link.dailyLimitMinutes !== null ? [link.dailyLimitMinutes] : [],
  );

  return limits.length > 0 ? Math.min(...limits) : null;
}

/**
 * The learning profile is Appearance's view; the belt and Energy only draw the buddy, and a
 * guardian's limit shows in the daily limit. Every setting but the language is saved on the
 * profile, so visitors only get the language.
 */
async function AppearanceContent() {
  const [profile, belt, energy, guardianLinks] = await Promise.all([
    getLearningProfile(),
    getBeltLevel(),
    getEnergyLevel(),
    listGuardianLinks(),
  ]);

  return (
    <AppearanceSettings
      view={{
        availableGlasses: profile?.availableGlasses ?? ["round"],
        buddy: profile?.buddy ?? null,
        canPersonalize: profile !== null,
        dailyLimitMinutes: profile?.dailyLimitMinutes ?? null,
        guardianLimitMinutes: getGuardianLimitMinutes(guardianLinks),
        isMinor: profile?.ageGroup === "teen",
        look: { beltColor: belt?.color ?? "white", energy: energy?.currentEnergy ?? 0 },
        soundsEnabled: profile?.soundsEnabled ?? true,
      }}
    />
  );
}

function AppearanceSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
    </div>
  );
}

export default async function AppearancePage() {
  const t = await getExtracted();

  return (
    <Page>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>{t("Appearance")}</PageTitle>
          <PageSubtitle>
            {t("Your buddy, lessons and language, the way you like them.")}
          </PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      <Suspense fallback={<AppearanceSkeleton />}>
        <AppearanceContent />
      </Suspense>
    </Page>
  );
}
