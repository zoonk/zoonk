import { getSession } from "@zoonk/core/users/session";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../_components/protected-section";
import { SettingsPage, SettingsPageTitle } from "../_components/settings-page";
import { DeleteAccountSection } from "./delete-account-section";
import { ExportDataButton } from "./export-data-button";
import { ProfileForm, ProfileFormSkeleton } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { description: t("Update your name and username on Zoonk."), title: t("Profile") };
}

const YOUR_DATA_ID = "your-data";

async function ProfileContent() {
  const t = await getExtracted();
  const session = await getSession();

  return (
    <ProtectedSection>
      <div className="flex flex-col gap-10">
        <ProfileForm
          defaultName={session?.user.name ?? ""}
          defaultUsername={session?.user.username ?? ""}
        />

        <section aria-labelledby={YOUR_DATA_ID} className="flex flex-col gap-3 lg:max-w-md">
          <h2 className="text-base font-semibold" id={YOUR_DATA_ID}>
            {t("Your data")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t(
              "Download everything Zoonk keeps about you: your profile, goals and plans, progress, answers, memory and feedback.",
            )}
          </p>
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
    <SettingsPage>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <SettingsPageTitle>{t("Profile")}</SettingsPageTitle>
          <ContainerDescription>
            {t("Your name and username as they appear to others.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ProfileFormSkeleton />}>
          <ProfileContent />
        </Suspense>
      </ContainerBody>
    </SettingsPage>
  );
}
