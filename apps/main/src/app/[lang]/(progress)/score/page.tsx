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

export const prefetch = "allow-runtime";

/** Describes the fixed Score window consistently in browser and social metadata. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("See your answer accuracy and weekly trend over the past 90 days."),
    title: t("Score"),
  };
}

/** Presents the rolling Score view in the same quiet width as Activity and Energy. */
export default async function ScorePage() {
  const t = await getExtracted();

  return (
    <Container className="max-w-2xl lg:max-w-2xl" variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Score")}</ContainerTitle>
          <ContainerDescription>
            {t("See how accurately you answer questions")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ScoreContentSkeleton />}>
          <ScoreContent />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
