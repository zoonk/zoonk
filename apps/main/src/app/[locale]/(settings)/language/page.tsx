"use cache";

import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cacheTagLanguage } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import LocaleSwitcher from "@/components/locale-switcher";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/language">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagLanguage());

  const t = await getTranslations({ locale, namespace: "Language" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default async function Language({
  params,
}: PageProps<"/[locale]/language">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagLanguage());

  const t = await getTranslations("Language");

  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>{t("title")}</ContainerTitle>
        <ContainerDescription>{t("subtitle")}</ContainerDescription>
      </ContainerHeader>

      <LocaleSwitcher />
    </Container>
  );
}
