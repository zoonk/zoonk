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

/** Whose settings these are, and the way to their profile: an account's name and email. */
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

/** The hub's rows at their size: the account, then the two groups of pages. */
function SettingsHubSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-33 w-full rounded-lg" />
      <Skeleton className="h-22 w-full rounded-lg" />
    </div>
  );
}

/**
 * From a tablet up the settings pages are tabs under the section's title, so the hub shows the
 * first of them: the profile for an account, Preferences for anyone else.
 */
async function FirstSettingsPage() {
  const session = await getSession();
  return session && !session.user.isAnonymous ? <ProfilePage /> : <AppearancePage />;
}

/**
 * The settings hub: whose account it is (its row opens the profile), then the settings pages in
 * lists (the learner's own, then the plan and help, then the way out), each opening its page.
 * Settings open here from the account menu. From a tablet up the tabs list the pages and the first
 * one shows under them; the server can't tell the screen's width, so both render and CSS shows one.
 */
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
