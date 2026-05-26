import { AdminSearch } from "@/components/admin-search";
import { parseGeneratedLessonStatus } from "@/lib/generated-lesson-status";
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
import { GeneratedLessonList } from "./generated-lesson-list";
import { GeneratedLessonStatusFilter } from "./generated-lesson-status-filter";

export const metadata: Metadata = { title: "Generated Lessons" };

/**
 * This page gives admins a terminal-state log for lesson generation so they can
 * audit completed output by default and switch to failures when debugging.
 */
export default async function GeneratedLessonsPage({ searchParams }: PageProps<"/lessons">) {
  const params = await searchParams;
  const status = parseGeneratedLessonStatus(params.status);
  const search = Array.isArray(params.search) ? params.search[0] : params.search;

  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Generated Lessons</ContainerTitle>
          <ContainerDescription>
            Review lessons that finished generation or need failure follow-up.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <div className="flex flex-col gap-3">
          <Suspense fallback={<div className="h-10" />}>
            <AdminSearch placeholder="Search by lesson, chapter, or course..." />
          </Suspense>

          <GeneratedLessonStatusFilter search={search} status={status} />
        </div>

        <Suspense>
          <GeneratedLessonList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
