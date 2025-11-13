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
import { getExtracted, setRequestLocale } from "next-intl/server";
import LocaleSwitcher from "@/components/locale-switcher";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/language">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagLanguage());

  const t = await getExtracted({ locale });

  return {
    description: t(
      "Update your Zoonk app language to learn in English, Portuguese, Spanish, French, or other supported languages.",
    ),
    title: t("Change Language"),
  };
}

export default async function Language({
  params,
}: PageProps<"/[locale]/language">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagLanguage());

  const t = await getExtracted();

  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>{t("Language")}</ContainerTitle>
        <ContainerDescription>
          {t("Choose the app language you prefer for this device.")}
        </ContainerDescription>
      </ContainerHeader>

      <LocaleSwitcher />
    </Container>
  );
}
