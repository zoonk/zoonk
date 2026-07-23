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
import { EnergyContent, EnergyContentSkeleton } from "./energy-content";

export const prefetch = "allow-runtime";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Energy is a 0% to 100% score based on recent activity and accuracy."),
    title: t("Energy"),
  };
}

export default async function EnergyPage() {
  const t = await getExtracted();

  return (
    <Container className="max-w-2xl lg:max-w-2xl" variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Energy")}</ContainerTitle>
          <ContainerDescription>
            {t("A 0% to 100% score for recent activity and accuracy")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<EnergyContentSkeleton />}>
          <EnergyContent />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
