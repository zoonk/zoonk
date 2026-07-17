import { AdminTableSkeleton, AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { AdminPagination } from "@/components/pagination";
import { listGeneratedLessons } from "@/data/lessons/list-generated-lessons";
import {
  type GeneratedLessonStatus,
  parseGeneratedLessonStatus,
} from "@/lib/generated-lesson-status";
import { parseSearchParams } from "@/lib/parse-search-params";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { GeneratedLessonRow } from "./generated-lesson-row";

/**
 * The generated lesson log mirrors the courses table but scopes results to the
 * terminal generation status selected in the URL.
 */
export async function GeneratedLessonList({
  searchParams,
}: {
  searchParams: PageProps<"/lessons">["searchParams"];
}) {
  const params = await searchParams;
  const { page, limit, offset, search } = parseSearchParams(params);
  const status = parseGeneratedLessonStatus(params.status);

  return (
    <CachedGeneratedLessonList
      limit={limit}
      offset={offset}
      page={page}
      search={search}
      status={status}
    />
  );
}

/**
 * Parsed filter and pagination primitives produce deterministic private-cache
 * entries for every generated-lesson URL that can be prefetched.
 */
async function CachedGeneratedLessonList({
  limit,
  offset,
  page,
  search,
  status,
}: {
  limit: number;
  offset: number;
  page: number;
  search?: string;
  status: GeneratedLessonStatus;
}) {
  "use cache: private";

  const { lessons, total } = await listGeneratedLessons({ limit, offset, search, status });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <GeneratedLessonTableHeader />

          <TableBody>
            {lessons.length > 0 ? (
              lessons.map((lesson) => <GeneratedLessonRow key={lesson.id} lesson={lesson} />)
            ) : (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={8}>
                  No lessons found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath="/lessons"
        limit={limit}
        page={page}
        queryParams={{ status }}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}

/**
 * The fallback exposes the complete operational table structure while the
 * selected status, search, and private lesson rows stream together.
 */
export function GeneratedLessonListSkeleton() {
  return (
    <AdminTableSkeleton className="overflow-x-auto">
      <Table>
        <GeneratedLessonTableHeader />

        <AdminTableSkeletonRows>
          <GeneratedLessonSkeletonRow />
        </AdminTableSkeletonRows>
      </Table>
    </AdminTableSkeleton>
  );
}

/**
 * Loaded and loading lesson tables share one header so review fields cannot
 * drift between the streamed states.
 */
function GeneratedLessonTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Lesson</TableHead>
        <TableHead>Kind</TableHead>
        <TableHead>Course</TableHead>
        <TableHead>Chapter</TableHead>
        <TableHead>Organization</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Steps</TableHead>
        <TableHead>Updated At</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/**
 * Lesson row placeholders retain the wider identity columns and compact status
 * fields used by the generated-content log.
 */
function GeneratedLessonSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-40" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-40" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
    </TableRow>
  );
}
