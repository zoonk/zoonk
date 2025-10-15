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
}: PageProps<"/[locale]/feedback">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, "feedback");

  const t = await getTranslations({ locale, namespace: "Feedback" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Feedback({
  params,
}: PageProps<"/[locale]/feedback">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, "feedback");

  const t = await getTranslations("Feedback");

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
