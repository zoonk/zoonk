import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { AdminTabs } from "@/components/admin-tabs";
import { buildAdminHref } from "@/lib/admin-href";
import {
  libraryLessonStatusLabels,
  libraryLessonStatuses,
  parseLibraryLessonStatus,
  parseProvenanceFilter,
} from "@/lib/library-lesson-filters";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type Metadata } from "next";
import { Suspense } from "react";
import {
  LessonProvenanceFilters,
  LessonProvenanceFiltersSkeleton,
} from "./lesson-provenance-filters";
import { LibraryLessonList, LibraryLessonListSkeleton } from "./library-lesson-list";
import { RewriteLessons } from "./rewrite-lessons";

export const metadata: Metadata = { title: "Lessons" };

type Params = Pick<PageProps<"/lessons">, "searchParams">;

async function readFilters({ searchParams }: Params) {
  const params = await searchParams;

  return {
    ...parseSearchParams(params),
    model: parseProvenanceFilter(params.model),
    promptVersion: parseProvenanceFilter(params.promptVersion),
    status: parseLibraryLessonStatus(params.status),
  };
}

async function RewriteAction({ searchParams }: Params) {
  const { model, promptVersion } = await readFilters({ searchParams });
  return <RewriteLessons model={model} promptVersion={promptVersion} />;
}

async function ProvenanceFilters({ searchParams }: Params) {
  const { model } = await readFilters({ searchParams });
  return <LessonProvenanceFilters model={model} />;
}

async function StateViews({ searchParams }: Params) {
  const { model, promptVersion, search, status } = await readFilters({ searchParams });

  return (
    <AdminTabs
      label="State"
      options={libraryLessonStatuses.map((item) => ({
        href: buildAdminHref({
          params: { model, promptVersion, search, status: item === "all" ? undefined : item },
          path: "/lessons",
        }),
        isActive: item === status,
        label: libraryLessonStatusLabels[item],
      }))}
    />
  );
}

async function Lessons({ searchParams }: Params) {
  const { limit, model, offset, page, promptVersion, search, status } = await readFilters({
    searchParams,
  });

  return (
    <LibraryLessonList
      limit={limit}
      model={model}
      offset={offset}
      page={page}
      promptVersion={promptVersion}
      search={search}
      status={status}
    />
  );
}

export default function LessonsPage({ searchParams }: PageProps<"/lessons">) {
  return (
    <AdminPage>
      <AdminPageHeader
        actions={
          <Suspense fallback={null}>
            <RewriteAction searchParams={searchParams} />
          </Suspense>
        }
        title="Lessons"
      />

      <AdminPageBody>
        <AdminToolbar>
          <Suspense fallback={<AdminSearchSkeleton />}>
            <AdminSearch placeholder="Search by lesson, chapter, or course…" />
          </Suspense>
          <Suspense fallback={null}>
            <StateViews searchParams={searchParams} />
          </Suspense>
          <Suspense fallback={<LessonProvenanceFiltersSkeleton />}>
            <ProvenanceFilters searchParams={searchParams} />
          </Suspense>
        </AdminToolbar>

        <Suspense fallback={<LibraryLessonListSkeleton />}>
          <Lessons searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
