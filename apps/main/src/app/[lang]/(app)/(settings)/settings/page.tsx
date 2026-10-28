import { UserAvatar } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar";
import { getMenu } from "@/lib/menu";
import { getCurrentUserMemory } from "@zoonk/core/memory/get";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { BuddyTabName } from "@zoonk/learn/buddy";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
} from "@zoonk/learn/list";
import { Page, PageHeader, PageHeaderContent, PageTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { LOCALE_LABELS, isValidLocale } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";
import { SettingsHubLists } from "../_components/settings-links";
import { getSettingsPagesShown } from "../_components/settings-pages-shown";
import ProfilePage from "../profile/page";
import AppearancePage from "./appearance/page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Settings") };
}

async function AccountRow() {
  const session = await getSession();

  if (!session || session.user.isAnonymous) {
    return null;
  }

  return (
    <ListGroup>
      <ListRowLink href={getMenu("profile").url}>
        <span className="flex size-9 shrink-0 self-center overflow-hidden rounded-full">
          <UserAvatar image={session.user.image} name={session.user.name || session.user.email} />
        </span>
        <ListRowContent>
          <ListRowTitle className="truncate">{session.user.name}</ListRowTitle>
          <ListRowDescription className="truncate">{session.user.email}</ListRowDescription>
        </ListRowContent>
      </ListRowLink>
    </ListGroup>
  );
}

async function SettingsHubContent() {
  const locale = await getLocale();

  const [shown, profile, memory] = await Promise.all([
    getSettingsPagesShown(),
    getLearningProfile(),
    getCurrentUserMemory(),
  ]);

  const language = isValidLocale(locale) ? LOCALE_LABELS[locale] : locale;

  return (
    <>
      <AccountRow />
      <SettingsHubLists
        {...shown}
        memoryCount={memory?.facts.length}
        preferencesSummary={
          <>
            {profile?.buddy && (
              <>
                <BuddyTabName buddy={profile.buddy} />
                {" · "}
              </>
            )}
            {language}
          </>
        }
      />
    </>
  );
}

function SettingsHubSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-33 w-full rounded-lg" />
      <Skeleton className="h-22 w-full rounded-lg" />
    </div>
  );
}

async function FirstSettingsPage() {
  const session = await getSession();
  return session && !session.user.isAnonymous ? <ProfilePage /> : <AppearancePage />;
}

/** The server can't tell the screen's width, so the hub and the first page both render and CSS shows one. */
export default async function SettingsPage() {
  const t = await getExtracted();

  return (
    <>
      <Page className="md:hidden">
        <PageHeader>
          <PageHeaderContent>
            <PageTitle>{t("Settings")}</PageTitle>
          </PageHeaderContent>
        </PageHeader>

        <Suspense fallback={<SettingsHubSkeleton />}>
          <SettingsHubContent />
        </Suspense>
      </Page>

      <div className="hidden md:block">
        <Suspense fallback={<SettingsHubSkeleton />}>
          <FirstSettingsPage />
        </Suspense>
      </div>
    </>
  );
}
