import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { parseGeneratedLessonStatus } from "@/lib/generated-lesson-status";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { GeneratedLessonList, GeneratedLessonListSkeleton } from "./generated-lesson-list";
import { GeneratedLessonStatusFilter } from "./generated-lesson-status-filter";

export const metadata: Metadata = { title: "Generated Lessons" };

/**
 * This page gives admins a terminal-state log for lesson generation so they can
 * see failed generations first and switch to completed output when auditing.
 */
export default function GeneratedLessonsPage({ searchParams }: PageProps<"/lessons">) {
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
        <Suspense fallback={<GeneratedLessonFiltersSkeleton />}>
          <GeneratedLessonFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<GeneratedLessonListSkeleton />}>
          <GeneratedLessonList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

/**
 * The selected generation status is request URL state, so only the filter
 * controls need to wait while the page heading remains in the static shell.
 */
async function GeneratedLessonFilters({
  searchParams,
}: Pick<PageProps<"/lessons">, "searchParams">) {
  const params = await searchParams;
  const status = parseGeneratedLessonStatus(params.status);
  const search = Array.isArray(params.search) ? params.search[0] : params.search;

  return (
    <div className="flex flex-col gap-3">
      <AdminSearch placeholder="Search by lesson, chapter, or course..." />
      <GeneratedLessonStatusFilter search={search} status={status} />
    </div>
  );
}

/**
 * Both filter rows depend on the same URL state, so their placeholder preserves
 * the complete control footprint until that state is available.
 */
function GeneratedLessonFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <AdminSearchSkeleton />
      <div className="flex gap-1">
        <Skeleton className="h-8 w-24 rounded-4xl" />
        <Skeleton className="h-8 w-24 rounded-4xl" />
      </div>
    </div>
  );
}
