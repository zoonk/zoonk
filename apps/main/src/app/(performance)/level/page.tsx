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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Track your level progress and see how you advance."),
    title: t("Level"),
  };
}

export default async function LevelPage({ searchParams }: PageProps<"/level">) {
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
          <LevelContent searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
