import { AdminSearchSkeleton } from "@/components/admin-search";
import { parseLibraryLessonStatus, parseProvenanceFilter } from "@/lib/library-lesson-filters";
import { parseSearchParams } from "@/lib/parse-search-params";
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
import { LibraryLessonFilters } from "./library-lesson-filters";
import { LibraryLessonList, LibraryLessonListSkeleton } from "./library-lesson-list";

export const metadata: Metadata = { title: "Lessons" };

/** Library lessons with their writing status and the model and prompt version that wrote them. */
export default function LessonsPage({ searchParams }: PageProps<"/lessons">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Lessons</ContainerTitle>
          <ContainerDescription>
            Library lessons, how far their writing got, and which model and prompt version wrote
            them.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<LessonsSkeleton />}>
          <LessonsContent searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

/** The filters and page all live in the URL, so they resolve together. */
async function LessonsContent({ searchParams }: Pick<PageProps<"/lessons">, "searchParams">) {
  const params = await searchParams;
  const { limit, offset, page, search } = parseSearchParams(params);

  const filters = {
    model: parseProvenanceFilter(params.model),
    promptVersion: parseProvenanceFilter(params.promptVersion),
    search,
    status: parseLibraryLessonStatus(params.status),
  };

  return (
    <>
      <Suspense fallback={<AdminSearchSkeleton />}>
        <LibraryLessonFilters {...filters} />
      </Suspense>
      <Suspense fallback={<LibraryLessonListSkeleton />}>
        <LibraryLessonList limit={limit} offset={offset} page={page} {...filters} />
      </Suspense>
    </>
  );
}

function LessonsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <AdminSearchSkeleton />
      <LibraryLessonListSkeleton />
    </div>
  );
}
