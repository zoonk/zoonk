"use cache";

import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsList } from "./settings-list";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, "settings");

  const t = await getTranslations({ locale, namespace: "Settings" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default async function Settings({
  params,
}: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, "settings");

  const t = await getTranslations("Settings");

  return (
    <Container className="p-0">
      <ContainerHeader className="px-4 pt-4">
        <ContainerTitle>{t("title")}</ContainerTitle>
        <ContainerDescription>{t("subtitle")}</ContainerDescription>
      </ContainerHeader>

      <SettingsList />
    </Container>
  );
}
