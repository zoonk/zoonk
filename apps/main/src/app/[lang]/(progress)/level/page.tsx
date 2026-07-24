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
import { LevelContent, LevelContentSkeleton } from "./level-content";

export const prefetch = "allow-runtime";

/** Keeps the browser description focused on the learner's current milestone. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { description: t("See your current level and what comes next."), title: t("Level") };
}

/** Renders the focused Level shell while the authenticated progress streams in. */
export default async function LevelPage() {
  const t = await getExtracted();

  return (
    <Container className="max-w-2xl lg:max-w-2xl" variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Level")}</ContainerTitle>
          <ContainerDescription>
            {t("See your current level and what comes next.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<LevelContentSkeleton />}>
          <LevelContent />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
