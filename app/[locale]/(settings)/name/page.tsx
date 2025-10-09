"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  PageContainer,
  PageHeader,
  PageSubtitle,
  PageTitle,
} from "@/components/pages";
import { ProtectedSection } from "@/components/protected-section";
import { NameForm } from "./name-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/name">): Promise<Metadata> {
  cacheLife("max");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Name" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Name({ params }: PageProps<"/[locale]/name">) {
  cacheLife("max");
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Name");

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{t("title")}</PageTitle>
        <PageSubtitle>{t("subtitle")}</PageSubtitle>
      </PageHeader>

      <ProtectedSection>
        <NameForm />
      </ProtectedSection>
    </PageContainer>
  );
}
