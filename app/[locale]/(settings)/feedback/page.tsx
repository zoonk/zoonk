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
}: PageProps<"/[locale]/feedback">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Feedback" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Feedback({
  params,
}: PageProps<"/[locale]/feedback">) {
  cacheLife("max");
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Feedback");

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{t("title")}</PageTitle>
        <PageSubtitle>{t("subtitle")}</PageSubtitle>
      </PageHeader>
    </PageContainer>
  );
}
