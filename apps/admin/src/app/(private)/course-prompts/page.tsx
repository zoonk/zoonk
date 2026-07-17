import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
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
import { CoursePromptList, CoursePromptListSkeleton } from "./course-prompt-list";

export const metadata: Metadata = { title: "Course Prompts" };
export const prefetch = "allow-runtime";

/**
 * Shows the durable routing decisions created by course-start entry points.
 * Admins can see raw prompts, assigned intent and format, canonical title, and generation
 * state without relying on the removed course-suggestion tables.
 */
export default function CoursePromptsPage({ searchParams }: PageProps<"/course-prompts">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Course Prompts</ContainerTitle>
          <ContainerDescription>
            See submitted prompts, routed intents and formats, canonical titles, and generation
            status.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<AdminSearchSkeleton />}>
          <AdminSearch placeholder="Search by prompt, title, intent, format, or course..." />
        </Suspense>

        <Suspense fallback={<CoursePromptListSkeleton />}>
          <CoursePromptList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
