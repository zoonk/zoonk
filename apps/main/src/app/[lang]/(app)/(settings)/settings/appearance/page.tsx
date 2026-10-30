import { SectionPageHeader } from "@/components/learn/section-page";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
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
    title: t({
      description:
        "A page inside Settings for the buddy, sounds, daily time limit and app language: use a word other than “Settings”.",
      message: "Preferences",
    }),
  };
}

/** Every setting but the language is saved on the profile, so visitors only get the language. */
async function AppearanceContent() {
  const [profile, buddy] = await Promise.all([getLearningProfile(), getLearnerBuddy()]);

  return (
    <AppearanceSettings
      view={{
        availableGlasses: profile?.availableGlasses ?? [buddy.glasses],
        buddy,
        canPersonalize: profile !== null,
        dailyLimitMinutes: profile?.dailyLimitMinutes ?? null,
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
      <SectionSkeleton className="h-15 rounded-lg" label={t("Language")} />
    </div>
  );
}

/** Preferences keeps `/settings/appearance`, its earlier address. */
export default async function AppearancePage() {
  const t = await getExtracted();

  return (
    <Page>
      <SectionPageHeader
        description={t("Your buddy, lessons and language, the way you like them.")}
        title={t({
          description:
            "A page inside Settings for the buddy, sounds, daily time limit and app language: use a word other than “Settings”.",
          message: "Preferences",
        })}
      />

      <Suspense fallback={<AppearanceSkeleton />}>
        <AppearanceContent />
      </Suspense>
    </Page>
  );
}
