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
import { PromptFilters, PromptFiltersSkeleton } from "./prompt-filters";
import { PromptList, PromptListSkeleton } from "./prompt-list";

export const metadata: Metadata = { title: "Prompts" };

export default function PromptsPage({ searchParams }: PageProps<"/prompts">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Prompts</ContainerTitle>
          <ContainerDescription>
            What learners and guests type to start a goal, what Zoonk read in it, and whether it
            became a goal.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<PromptFiltersSkeleton />}>
          <PromptFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<PromptListSkeleton />}>
          <PromptList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
