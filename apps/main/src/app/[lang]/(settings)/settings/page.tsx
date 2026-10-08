import { UserAvatar } from "@/app/[lang]/(catalog)/_components/user-avatar";
import { getMenu } from "@/lib/menu";
import { getSession } from "@zoonk/core/users/session";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
} from "@zoonk/learn/list";
import { Page, PageHeader, PageHeaderContent, PageTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { SettingsHubLists } from "../_components/settings-links";
import { getSettingsPagesShown } from "../_components/settings-pages-shown";
import ProfilePage from "../profile/page";
import AppearancePage from "./appearance/page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Settings") };
}

/** Whose settings these are, opening the profile: an account's name and email. */
async function AccountRow() {
  const session = await getSession();

  if (!session || session.user.isAnonymous) {
    return null;
  }

  return (
    <ListGroup>
      <ListRowLink href={getMenu("profile").url}>
        <span className="flex size-12 shrink-0 self-center overflow-hidden rounded-full">
          <UserAvatar />
        </span>
        <ListRowContent className="min-h-18">
          <ListRowTitle className="truncate font-semibold">{session.user.name}</ListRowTitle>
          <ListRowDescription className="truncate">{session.user.email}</ListRowDescription>
        </ListRowContent>
      </ListRowLink>
    </ListGroup>
  );
}

async function SettingsHubContent() {
  return (
    <>
      <AccountRow />
      <SettingsHubLists {...await getSettingsPagesShown()} />
    </>
  );
}

function SettingsHubSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-18 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

/**
 * From `lg` the settings pages are in the sidebar, so the hub shows the first of them beside it:
 * the profile for an account, Appearance for anyone else.
 */
async function FirstSettingsPage() {
  const session = await getSession();
  return session && !session.user.isAnonymous ? <ProfilePage /> : <AppearancePage />;
}

/**
 * The settings hub: whose account it is, then the settings pages in lists (the learner's own, then
 * the plan and help, then the way out), each opening its page. Settings open here from the account
 * menu. From `lg` the sidebar lists the pages and the first one shows beside it.
 */
export default async function SettingsPage() {
  const t = await getExtracted();

  return (
    <>
      <Page className="lg:hidden">
        <PageHeader>
          <PageHeaderContent>
            <PageTitle>{t("Settings")}</PageTitle>
          </PageHeaderContent>
        </PageHeader>

        <Suspense fallback={<SettingsHubSkeleton />}>
          <SettingsHubContent />
        </Suspense>
      </Page>

      <div className="hidden lg:block">
        <Suspense fallback={<SettingsHubSkeleton />}>
          <FirstSettingsPage />
        </Suspense>
      </div>
    </>
  );
}
