import { AdminSearch } from "@/components/admin-search";
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
import {
  CourseSuggestionPromptList,
  CourseSuggestionPromptListSkeleton,
} from "./course-suggestion-prompt-list";

export const metadata: Metadata = { title: "Course Suggestions" };

/**
 * This page keeps the only admin-visible part of the old course-suggestion
 * flow: a read-only log of submitted prompts, the suggestions returned, and
 * whether each suggestion became a generated course.
 */
export default function CourseSuggestionsPage({ searchParams }: PageProps<"/course-suggestions">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Course Suggestions</ContainerTitle>
          <ContainerDescription>
            See submitted prompts, suggested courses, and generation status.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<div className="h-10" />}>
          <AdminSearch placeholder="Search by prompt or suggested course..." />
        </Suspense>

        <Suspense fallback={<CourseSuggestionPromptListSkeleton />}>
          <CourseSuggestionPromptList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
