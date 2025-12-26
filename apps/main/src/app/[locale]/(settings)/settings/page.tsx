"use cache";

import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { SettingsList } from "./settings-list";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Customize your Zoonk learning experience. Manage account settings, profile, and preferences to get the most out of our education platform.",
    ),
    title: t("Settings"),
  };
}

export default async function Settings({
  params,
}: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getExtracted();

  return (
    <Container className="gap-2 lg:gap-2" variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Settings")}</ContainerTitle>
          <ContainerDescription>
            {t("Manage your account settings, profile, and preferences.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <SettingsList />
    </Container>
  );
}
