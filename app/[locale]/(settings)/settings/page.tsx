"use cache";

import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  PageContainer,
  PageHeader,
  PageSubtitle,
  PageTitle,
} from "@/components/pages";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings">): Promise<Metadata> {
  cacheLife("max");
  cacheTag("settings-page");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Settings({
  params,
}: PageProps<"/[locale]/settings">) {
  cacheLife("max");
  cacheTag("settings-page");
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Settings");

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{t("title")}</PageTitle>
        <PageSubtitle>{t("subtitle")}</PageSubtitle>
      </PageHeader>
    </PageContainer>
  );
}
