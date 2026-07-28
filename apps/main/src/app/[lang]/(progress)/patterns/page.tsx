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
import { PatternsContent, PatternsContentSkeleton } from "./patterns-content";

/** Names the learner's complete fixed-window performance patterns. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("See when you perform best over the past 90 days."),
    title: t("Patterns"),
  };
}

/** Presents Patterns as its own progress destination instead of a Score subpage. */
export default async function PatternsPage() {
  const t = await getExtracted();

  return (
    <Container className="max-w-2xl lg:max-w-2xl" variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Patterns")}</ContainerTitle>
          <ContainerDescription>{t("See when you perform best")}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<PatternsContentSkeleton />}>
          <PatternsContent />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
