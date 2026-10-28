import { SectionPage } from "@/components/learn/section-page";
import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";
import { getMenu } from "@/lib/menu";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { SettingsAccountAction } from "./_components/settings-account-action";
import { SettingsEyebrow } from "./_components/settings-eyebrow";
import { SettingsNavbar, SettingsNavbarSkeleton } from "./_components/settings-navbar";

export default async function Layout({ children }: LayoutProps<"/[lang]">) {
  const t = await getExtracted();

  return (
    <>
      <SectionPage
        contentClassName="max-w-form"
        end={
          <Suspense fallback={null}>
            <SettingsAccountAction />
          </Suspense>
        }
        eyebrow={
          <Suspense fallback={null}>
            <SettingsEyebrow />
          </Suspense>
        }
        hub={{ href: getMenu("settings").url, title: t("Settings") }}
        nav={
          <Suspense fallback={<SettingsNavbarSkeleton />}>
            <SettingsNavbar />
          </Suspense>
        }
      >
        {children}
      </SectionPage>
      <LearnerSummarySeed />
    </>
  );
}
