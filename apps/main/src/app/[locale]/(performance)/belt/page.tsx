import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { BeltContent, BeltContentSkeleton } from "./belt-content";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/belt">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t("Track your belt level progress and see how you advance."),
    title: t("Belt Level"),
  };
}

export default async function BeltPage({
  params,
  searchParams,
}: PageProps<"/[locale]/belt">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Belt Level")}</ContainerTitle>
          <ContainerDescription>
            {t("Track your belt level progress")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<BeltContentSkeleton />}>
          <BeltContent locale={locale} searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
