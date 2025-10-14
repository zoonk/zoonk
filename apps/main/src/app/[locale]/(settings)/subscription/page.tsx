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
import { ProtectedSection } from "@/components/protected-section";
import { SubscriptionPage } from "./subscription-page";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/subscription">): Promise<Metadata> {
  cacheLife("max");
  cacheTag("subscription-page");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Subscription" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Subscription({
  params,
}: PageProps<"/[locale]/subscription">) {
  cacheLife("max");
  cacheTag("subscription-page");
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Subscription");

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{t("title")}</PageTitle>
        <PageSubtitle>{t("subtitle")}</PageSubtitle>
      </PageHeader>

      <ProtectedSection>
        <SubscriptionPage />
      </ProtectedSection>
    </PageContainer>
  );
}
