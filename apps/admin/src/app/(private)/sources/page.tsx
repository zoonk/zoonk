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
import { SourceFilters, SourceFiltersSkeleton } from "./source-filters";
import { SourceList, SourceListSkeleton } from "./source-list";

export const metadata: Metadata = { title: "Sources" };

/** Documents exams and items are read from, with their freshness dates. */
export default function SourcesPage({ searchParams }: PageProps<"/sources">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Sources</ContainerTitle>
          <ContainerDescription>
            Official notices, secondary pages and learner uploads. Private uploads show metadata
            only.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<SourceFiltersSkeleton />}>
          <SourceFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<SourceListSkeleton />}>
          <SourceList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
