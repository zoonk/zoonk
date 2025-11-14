"use cache";

import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { ProtectedSection } from "@/components/protected-section";
import { PageForm } from "./page-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/pages/new">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");

  const t = await getExtracted({ locale });

  return {
    description: t(
      "Create a page for your business or organization on Zoonk. Share courses and content with your audience.",
    ),
    title: t("Create Page"),
  };
}

export default async function NewPage({
  params,
}: PageProps<"/[locale]/pages/new">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");

  const t = await getExtracted();

  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>{t("Create a new page")}</ContainerTitle>
        <ContainerDescription>
          {t(
            "Create a page for your business or organization. You'll be able to add courses and content later.",
          )}
        </ContainerDescription>
      </ContainerHeader>

      <ProtectedSection>
        <PageForm />
      </ProtectedSection>
    </Container>
  );
}
