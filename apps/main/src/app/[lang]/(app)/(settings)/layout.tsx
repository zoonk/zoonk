import { SectionPage } from "@/components/learn/section-page";
import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";
import { getMenu } from "@/lib/menu";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { FollowUs } from "./_components/follow-us";
import { SettingsAccountAction } from "./_components/settings-account-action";
import { SettingsAside, SettingsAsideSkeleton } from "./_components/settings-aside";
import { SettingsAsideSlot } from "./_components/settings-aside-slot";
import { SettingsNavbar, SettingsNavbarSkeleton } from "./_components/settings-navbar";

export default async function Layout({ children }: LayoutProps<"/[lang]">) {
  const t = await getExtracted();

  return (
    <>
      <SectionPage
        aside={
          <SettingsAsideSlot
            detailsUnder={[getMenu("aboutYou").url]}
            extras={[{ content: <FollowUs />, href: getMenu("support").url }]}
          >
            <Suspense fallback={<SettingsAsideSkeleton />}>
              <SettingsAside />
            </Suspense>
          </SettingsAsideSlot>
        }
        asideLabel={t("Your account")}
        end={
          <Suspense fallback={null}>
            <SettingsAccountAction />
          </Suspense>
        }
        hub={{ href: getMenu("settings").url, title: t("Settings") }}
        nav={
          <Suspense fallback={<SettingsNavbarSkeleton />}>
            <SettingsNavbar />
          </Suspense>
        }
        parents={[{ href: getMenu("aboutYou").url, title: t("About you") }]}
      >
        {children}
      </SectionPage>
      <LearnerSummarySeed />
    </>
  );
}
