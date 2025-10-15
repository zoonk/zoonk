"use cache";

import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/blocks/contact-form";

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
    <Container>
      <ContainerHeader>
        <ContainerTitle>{t("title")}</ContainerTitle>
        <ContainerDescription>{t("subtitle")}</ContainerDescription>
      </ContainerHeader>

      <ContactForm />
    </Container>
  );
}
