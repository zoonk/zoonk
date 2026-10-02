import { AdminSectionSkeleton } from "@/components/admin-section";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { AiCostSection } from "./ai-cost-section";
import { GenerationFailuresSection } from "./generation-failures-section";
import { ProvenanceSection } from "./provenance-section";

export const metadata: Metadata = { title: "AI" };

/** Each section reads a different source (PostHog, provenance, workflow status) and streams alone. */
export default function AiPage({ searchParams }: PageProps<"/ai">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>AI</ContainerTitle>
          <ContainerDescription>
            What model calls cost, what each model wrote, and which generations failed.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-10">
        <Suspense fallback={<AdminSectionSkeleton />}>
          <AiCostSection />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton />}>
          <ProvenanceSection searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton />}>
          <GenerationFailuresSection />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
