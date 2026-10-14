import { SectionPage } from "@/components/learn/section-page";
import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";
import { getMenu } from "@/lib/menu";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { SettingsAccountAction } from "./_components/settings-account-action";
import { SettingsEyebrow } from "./_components/settings-eyebrow";
import { SettingsNavbar, SettingsNavbarSkeleton } from "./_components/settings-navbar";

/**
 * Settings are a section of the app: from a tablet up whose account it is, the section's title and
 * its pages as tabs head every settings page across the room, and each page's form keeps its
 * measure on the same left edge, where every title starts; on phones the section's own bar is
 * the page's top, with the way back and a visitor's or a guest's way in. They open on their hub
 * (`/settings`), a list of the settings pages, and each page goes back to it.
 */
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
