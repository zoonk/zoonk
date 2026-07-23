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
import { ActivityContent, ActivityContentSkeleton } from "./activity-content";

export const prefetch = "allow-runtime";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Track your completed lessons, learning days, and learning time."),
    title: t("Activity"),
  };
}

export default async function ActivityPage() {
  const t = await getExtracted();

  return (
    <Container className="max-w-2xl lg:max-w-2xl" variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Activity")}</ContainerTitle>
          <ContainerDescription>{t("See your learning activity over time")}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ActivityContentSkeleton />}>
          <ActivityContent />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
