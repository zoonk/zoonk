import { getSession } from "@zoonk/core/users/session";
import {
  Page,
  PageHeader,
  PageHeaderContent,
  PageSectionTitle,
  PageSubtitle,
  PageTitle,
} from "@zoonk/learn/page";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../_components/protected-section";
import { DeleteAccountSection } from "./delete-account-section";
import { ExportDataButton } from "./export-data-button";
import { ProfileForm, ProfileFormSkeleton } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { description: t("Your name, username and account on Zoonk."), title: t("Profile") };
}

const YOUR_DATA_ID = "your-data";

async function ProfileContent() {
  const t = await getExtracted();
  const session = await getSession();

  return (
    <ProtectedSection>
      <div className="flex flex-col gap-8">
        <ProfileForm
          defaultName={session?.user.name ?? ""}
          defaultUsername={session?.user.username ?? ""}
        />

        <section aria-labelledby={YOUR_DATA_ID} className="flex flex-col gap-3">
          <PageSectionTitle className="px-1" id={YOUR_DATA_ID}>
            {t("Your data")}
          </PageSectionTitle>
          <ExportDataButton />
        </section>

        <DeleteAccountSection />
      </div>
    </ProtectedSection>
  );
}

export default async function ProfilePage() {
  const t = await getExtracted();

  return (
    <Page>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>{t("Profile")}</PageTitle>
          <PageSubtitle>{t("Your name, username and account.")}</PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      <Suspense fallback={<ProfileFormSkeleton />}>
        <ProfileContent />
      </Suspense>
    </Page>
  );
}
