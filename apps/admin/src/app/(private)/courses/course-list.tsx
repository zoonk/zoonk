import { AdminTableSkeleton, AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { AdminPagination } from "@/components/pagination";
import { listCourses } from "@/data/courses/list-courses";
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
import { CourseRow } from "./course-row";

/**
 * Course URL state, protected loading, and pagination resolve together so a
 * refreshed or shared admin URL always describes the rows on screen.
 */
export async function CourseList({
  searchParams,
}: {
  searchParams: PageProps<"/courses">["searchParams"];
}) {
  const { page, limit, offset, search } = parseSearchParams(await searchParams);

  return <CachedCourseList limit={limit} offset={offset} page={page} search={search} />;
}

/**
 * Primitive URL values make each list state a deterministic browser-private
 * cache entry that runtime prefetching can prepare before navigation.
 */
async function CachedCourseList({
  limit,
  offset,
  page,
  search,
}: {
  limit: number;
  offset: number;
  page: number;
  search?: string;
}) {
  "use cache: private";

  const { courses, total } = await listCourses({ limit, offset, search });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <CourseTableHeader />

          <TableBody>
            {courses.map((course) => (
              <CourseRow course={course} key={course.id} />
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath="/courses"
        limit={limit}
        page={page}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}

/**
 * The fallback uses the real course columns so admins see the table structure
 * immediately while private course data streams in.
 */
export function CourseListSkeleton() {
  return (
    <AdminTableSkeleton className="overflow-x-auto">
      <Table>
        <CourseTableHeader />

        <AdminTableSkeletonRows>
          <CourseSkeletonRow />
        </AdminTableSkeletonRows>
      </Table>
    </AdminTableSkeleton>
  );
}

/**
 * Loaded and loading course tables share one header so their columns cannot
 * drift as the admin catalog grows.
 */
function CourseTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Title</TableHead>
        <TableHead>Organization</TableHead>
        <TableHead>Language</TableHead>
        <TableHead className="text-right">Completed Lessons</TableHead>
        <TableHead>Published</TableHead>
        <TableHead>Created At</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/**
 * Course row placeholders preserve the relative width of identity, ownership,
 * status, and date fields during streaming.
 */
function CourseSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-10" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-10" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-5" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
    </TableRow>
  );
}
