import { SectionPageHeader } from "@/components/learn/section-page";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { AppearanceSettings } from "./appearance-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Preferences"),
    robots: { follow: false, index: false },
    title: t({
      description:
        "A page inside Settings for the buddy, sounds and app language: use a word other than “Settings”.",
      message: "Preferences",
    }),
  };
}

/** Visitors get only the language, which their browser keeps. */
async function AppearanceContent() {
  const language = await lang();
  const [profile, buddy] = await Promise.all([getLearningProfile(language), getLearnerBuddy()]);

  return (
    <AppearanceSettings
      view={{
        availableGlasses: profile?.availableGlasses ?? [buddy.glasses],
        buddy,
        canPersonalize: profile !== null,
        homeCountry:
          profile?.homeCountry && profile.homeCountryName
            ? { code: profile.homeCountry, name: profile.homeCountryName }
            : null,
        homeCountrySuggested: profile?.suggested ?? [],
        look: {
          beltColor: buddy.beltColor,
          energy: buddy.energy,
          studiedToday: buddy.studiedToday,
        },
        soundsEnabled: profile?.soundsEnabled ?? true,
      }}
    />
  );
}

function SectionSkeleton({ className, label }: { className: string; label: string }) {
  return (
    <PageSection>
      <PageSectionHeader>
        <PageSectionTitle>{label}</PageSectionTitle>
      </PageSectionHeader>
      <Skeleton className={className} />
    </PageSection>
  );
}

async function AppearanceSkeleton() {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-7">
      <SectionSkeleton className="h-15 rounded-lg" label={t("Your buddy")} />
      <SectionSkeleton className="h-30 rounded-lg" label={t("Lessons")} />
      <SectionSkeleton className="h-30 rounded-lg" label={t("Language and region")} />
    </div>
  );
}

/** Preferences keeps `/settings/appearance`, its earlier address. */
export default async function AppearancePage() {
  const t = await getExtracted();

  return (
    <Page className="max-w-form">
      <SectionPageHeader
        title={t({
          description:
            "A page inside Settings for the buddy, sounds and app language: use a word other than “Settings”.",
          message: "Preferences",
        })}
      />

      <Suspense fallback={<AppearanceSkeleton />}>
        <AppearanceContent />
      </Suspense>
    </Page>
  );
}
