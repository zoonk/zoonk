import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LocaleSwitcher, LocaleSwitcherSkeleton } from "../_components/locale-switcher";
import { SettingsPage, SettingsPageTitle } from "../_components/settings-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Update your app language to learn in English, Portuguese, Spanish, French, or other supported languages.",
    ),
    title: t("Update language"),
  };
}

export default async function Language() {
  const t = await getExtracted();

  return (
    <SettingsPage>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <SettingsPageTitle>{t("Language")}</SettingsPageTitle>
          <ContainerDescription>
            {t("Choose the app language you prefer for this device.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<LocaleSwitcherSkeleton />}>
          <LocaleSwitcher />
        </Suspense>
      </ContainerBody>
    </SettingsPage>
  );
}
