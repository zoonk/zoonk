import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LevelContent, LevelContentSkeleton } from "./level-content";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/level">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t("Track your level progress and see how you advance."),
    title: t("Level"),
  };
}

export default async function LevelPage({ params, searchParams }: PageProps<"/[locale]/level">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Level")}</ContainerTitle>
          <ContainerDescription>{t("Track your level progress")}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<LevelContentSkeleton />}>
          <LevelContent locale={locale} searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
