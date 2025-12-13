"use cache";

import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cacheTagSettings } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { SettingsList } from "./settings-list";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagSettings());

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

  cacheLife("max");
  cacheTag(locale, cacheTagSettings());

  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerTitle>{t("Settings")}</ContainerTitle>
        <ContainerDescription>
          {t("Manage your account settings, profile, and preferences.")}
        </ContainerDescription>
      </ContainerHeader>

      <ContainerBody>
        <SettingsList />
      </ContainerBody>
    </Container>
  );
}
