"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { PageSubtitle } from "@/components/PageSubtitle";
import { PageTitle } from "@/components/PageTitle";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help">): Promise<Metadata> {
  cacheLife("max");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Help" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Help({ params }: PageProps<"/[locale]/help">) {
  cacheLife("max");
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Help");

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{t("title")}</PageTitle>
        <PageSubtitle>{t("subtitle")}</PageSubtitle>
      </PageHeader>
    </PageContainer>
  );
}
