import { SectionFrame } from "@/components/learn/section-frame";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { SettingsAccountAction } from "./_components/settings-account-action";
import { SettingsNavbar, SettingsNavbarSkeleton } from "./_components/settings-navbar";

const SETTINGS_HUB_HREF = "/settings";

/**
 * Settings are a section: their own bar replaces the app's, with the way back and the account's way
 * in or out. They open on their hub (`/settings`), a list of the settings pages; each page goes
 * back to it and, from `lg`, keeps the pages in a sidebar beside it.
 */
export default async function Layout({ children }: LayoutProps<"/[lang]">) {
  const t = await getExtracted();

  return (
    <ClientMessagesProvider scope="learn">
      <SectionFrame
        end={
          <Suspense fallback={null}>
            <SettingsAccountAction />
          </Suspense>
        }
        hub={{
          href: SETTINGS_HUB_HREF,
          nav: (
            <Suspense fallback={<SettingsNavbarSkeleton />}>
              <SettingsNavbar />
            </Suspense>
          ),
          title: t("Settings"),
        }}
      >
        {children}
      </SectionFrame>
    </ClientMessagesProvider>
  );
}
