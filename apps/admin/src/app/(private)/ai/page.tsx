import { AdminFilterNav } from "@/components/admin-filter-nav";
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
import { aiPeriodDays, parseAiPeriodDays } from "./_utils/ai-period";
import { AiPlusLearnersSection } from "./ai-plus-learners-section";
import { AiSpendSection } from "./ai-spend-section";
import { AiTopSpendersSection } from "./ai-top-spenders-section";
import { GenerationFailuresSection } from "./generation-failures-section";
import { ProvenanceSection } from "./provenance-section";

export const metadata: Metadata = { title: "AI" };

function PeriodFilter({ days }: { days: number }) {
  return (
    <AdminFilterNav
      label="Period"
      options={aiPeriodDays.map((period) => ({
        href: `/ai?days=${period}`,
        isActive: period === days,
        label: `${period} days`,
      }))}
    />
  );
}

/** The period comes from the URL; every section below reads the same one. */
async function AiSections({ searchParams }: { searchParams: PageProps<"/ai">["searchParams"] }) {
  const params = await searchParams;
  const days = parseAiPeriodDays(params.days);

  return (
    <>
      <PeriodFilter days={days} />

      <Suspense fallback={<AdminSectionSkeleton />}>
        <AiSpendSection days={days} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <AiTopSpendersSection days={days} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <ProvenanceSection days={days} />
      </Suspense>
    </>
  );
}

/**
 * Each section reads a different source (the AI call log, provenance, workflow status) and streams
 * alone. Plus learners' costs follow the calendar month, as plans are paid, not the period filter.
 */
export default function AiPage({ searchParams }: PageProps<"/ai">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>AI</ContainerTitle>
          <ContainerDescription>
            What model calls cost, what each Plus learner costs against their plan, what each model
            wrote, and which generations failed.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-10">
        <Suspense fallback={<AdminSectionSkeleton />}>
          <AiSections searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton />}>
          <AiPlusLearnersSection />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton />}>
          <GenerationFailuresSection />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
