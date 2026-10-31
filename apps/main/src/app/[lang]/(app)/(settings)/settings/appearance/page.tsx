import { SectionPageHeader } from "@/components/learn/section-page";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getRequestCountry } from "@zoonk/utils/locale-request";
import {
  USAGE_DATA_COOKIE,
  getUsageDataChoice,
  parseUsageDataCookie,
  resolveUsageDataSharing,
} from "@zoonk/utils/usage-data";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { cookies, headers } from "next/headers";
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

/** Off until the visitor says yes where the law needs one, as `AppAnalytics` decides. */
async function readShareUsageData(account: boolean | null): Promise<boolean> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const browser = parseUsageDataCookie(cookieStore.get(USAGE_DATA_COOKIE)?.value);

  const share = resolveUsageDataSharing({
    choice: getUsageDataChoice({ account, browser }),
    country: getRequestCountry(requestHeaders),
  });

  return share ?? false;
}

/** Visitors get only the language and usage data, which their browser keeps. */
async function AppearanceContent() {
  const [profile, buddy] = await Promise.all([getLearningProfile(), getLearnerBuddy()]);
  const shareUsageData = await readShareUsageData(profile?.shareUsageData ?? null);

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
        shareUsageData,
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
      <SectionSkeleton className="h-15 rounded-lg" label={t("Privacy")} />
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
