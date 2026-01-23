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
import { ScoreContent, ScoreContentSkeleton } from "./score-content";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/score">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t("Track your score over time and see your best days and times."),
    title: t("Score"),
  };
}

export default async function ScorePage({ params, searchParams }: PageProps<"/[locale]/score">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Score")}</ContainerTitle>
          <ContainerDescription>
            {t("Track your score and performance trends")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ScoreContentSkeleton />}>
          <ScoreContent locale={locale} searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
