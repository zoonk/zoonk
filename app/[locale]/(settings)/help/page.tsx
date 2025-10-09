"use cache";

import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/contact-form";
import {
  PageContainer,
  PageHeader,
  PageSubtitle,
  PageTitle,
} from "@/components/pages";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help">): Promise<Metadata> {
  cacheLife("max");
  cacheTag("help-page");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Help" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Help({ params }: PageProps<"/[locale]/help">) {
  cacheLife("max");
  cacheTag("help-page");
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Help");

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{t("title")}</PageTitle>
        <PageSubtitle>{t("subtitle")}</PageSubtitle>
      </PageHeader>

      <ContactForm />
    </PageContainer>
  );
}
