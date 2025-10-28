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
import { ProtectedSection } from "@/components/protected-section";
import { SubscriptionPage } from "./subscription-page";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/subscription">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, "subscription");

  const t = await getTranslations({ locale, namespace: "Subscription" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default async function Subscription({
  params,
}: PageProps<"/[locale]/subscription">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, "subscription");

  const t = await getTranslations("Subscription");

  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>{t("title")}</ContainerTitle>
        <ContainerDescription>{t("subtitle")}</ContainerDescription>
      </ContainerHeader>

      <ProtectedSection>
        <SubscriptionPage />
      </ProtectedSection>
    </Container>
  );
}
