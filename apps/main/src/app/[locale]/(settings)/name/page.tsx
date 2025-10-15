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
import { ProtectedSection } from "@/blocks/protected-section";
import { NameForm } from "./name-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/name">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, "name");

  const t = await getTranslations({ locale, namespace: "Name" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Name({ params }: PageProps<"/[locale]/name">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, "name");

  const t = await getTranslations("Name");

  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>{t("title")}</ContainerTitle>
        <ContainerDescription>{t("subtitle")}</ContainerDescription>
      </ContainerHeader>

      <ProtectedSection>
        <NameForm />
      </ProtectedSection>
    </Container>
  );
}
