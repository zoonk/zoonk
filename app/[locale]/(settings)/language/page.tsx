"use cache";

import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import LocaleSwitcher from "@/components/locale-switcher";
import {
  PageContainer,
  PageHeader,
  PageSubtitle,
  PageTitle,
} from "@/components/pages";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/language">): Promise<Metadata> {
  cacheLife("max");
  cacheTag("language-page");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Language" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Language({
  params,
}: PageProps<"/[locale]/language">) {
  cacheLife("max");
  cacheTag("language-page");
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Language");

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{t("title")}</PageTitle>
        <PageSubtitle>{t("subtitle")}</PageSubtitle>
      </PageHeader>

      <LocaleSwitcher />
    </PageContainer>
  );
}
