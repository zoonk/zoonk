import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ScoreContent, ScoreContentSkeleton } from "./score-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Track your score over time and see your best days and times."),
    title: t("Score"),
  };
}

export default async function ScorePage({ searchParams }: PageProps<"/score">) {
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
          <ScoreContent searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
