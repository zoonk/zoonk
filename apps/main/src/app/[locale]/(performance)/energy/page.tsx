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
import { EnergyContent, EnergyContentSkeleton } from "./energy-content";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/energy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Track your energy over time and see how your learning consistency affects your progress.",
    ),
    title: t("Energy"),
  };
}

export default async function EnergyPage({
  params,
  searchParams,
}: PageProps<"/[locale]/energy">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Energy")}</ContainerTitle>
          <ContainerDescription>
            {t("Track your learning energy over time")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<EnergyContentSkeleton />}>
          <EnergyContent locale={locale} searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
