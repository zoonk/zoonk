import { SectionPageHeader } from "@/components/learn/section-page";
import { getSession } from "@zoonk/core/users/session";
import { ListGroup } from "@zoonk/learn/list";
import { NameHint } from "@zoonk/learn/name-hint";
import { Page } from "@zoonk/learn/page";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../_components/protected-section";
import { PasskeysSection } from "./passkeys-section";
import { ProfileForm } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { description: t("Your name, username and account on Zoonk."), title: t("Profile") };
}

async function ProfileContent() {
  const session = await getSession();

  return (
    <ProtectedSection next="/profile">
      <ProfileForm
        defaultName={session?.user.name ?? ""}
        defaultUsername={session?.user.username ?? ""}
      >
        <PasskeysSection />
      </ProfileForm>
    </ProtectedSection>
  );
}

async function ProfileSkeleton() {
  const t = await getExtracted();

  return (
    <>
      <ListGroup>
        <SettingRow description={<NameHint />} label={t("Name")} wide>
          <Skeleton className="h-11 w-full rounded-lg" />
        </SettingRow>
        <SettingRow label={t("Username")} wide>
          <Skeleton className="h-11 w-full rounded-lg" />
        </SettingRow>
      </ListGroup>
      <BottomBar>
        <BottomBarActions>
          <Skeleton className="h-11 w-full rounded-md sm:w-24" />
        </BottomBarActions>
      </BottomBar>
    </>
  );
}

export default async function ProfilePage() {
  const t = await getExtracted();

  return (
    <Page className="max-w-form">
      <SectionPageHeader title={t("Profile")} />

      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </Page>
  );
}
