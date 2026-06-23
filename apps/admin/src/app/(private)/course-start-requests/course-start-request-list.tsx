import { AdminPagination } from "@/components/pagination";
import {
  type ListedCourseStartRequest,
  listCourseStartRequests,
} from "@/data/course-start-requests/list-course-start-requests";
import { parseSearchParams } from "@/lib/parse-search-params";
import { Badge } from "@zoonk/ui/components/badge";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

const SKELETON_ROW_COUNT = 5;
const TABLE_COLUMN_COUNT = 6;

/**
 * The list is server-rendered so admins can refresh/share a filtered page and
 * still inspect private prompt routing decisions without client-side fetching.
 */
export async function CourseStartRequestList({
  searchParams,
}: {
  searchParams: PageProps<"/course-start-requests">["searchParams"];
}) {
  const { page, limit, offset, search } = parseSearchParams(await searchParams);
  const { requests, total } = await listCourseStartRequests({ limit, offset, search });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {total.toLocaleString()} submitted {total === 1 ? "request" : "requests"}.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <CourseStartRequestTableHeader />

          <TableBody>
            {requests.length > 0 ? (
              requests.map((request) => (
                <CourseStartRequestRow key={request.id} request={request} />
              ))
            ) : (
              <CourseStartRequestEmptyRow />
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath="/course-start-requests"
        limit={limit}
        page={page}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}

/**
 * The fallback mirrors the loaded table so the page does not jump from a blank
 * area into a dense operational table once the query resolves.
 */
export function CourseStartRequestListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-40" />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <CourseStartRequestTableHeader />

          <TableBody>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- Skeleton rows are fixed placeholders.
              <CourseStartRequestSkeletonRow key={index} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * The loaded and skeleton tables share labels so operational meaning stays
 * stable while data streams in.
 */
function CourseStartRequestTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Prompt</TableHead>
        <TableHead>Scope</TableHead>
        <TableHead>Canonical Title</TableHead>
        <TableHead>Generation</TableHead>
        <TableHead>Course</TableHead>
        <TableHead>Submitted</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/**
 * Empty rows stay inside the table so filtered pages preserve the same layout
 * as the full request log.
 */
function CourseStartRequestEmptyRow() {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>
        No course start requests found.
      </TableCell>
    </TableRow>
  );
}

/**
 * Row-sized placeholders keep the table columns stable during streaming.
 */
function CourseStartRequestSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-72" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-44" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
    </TableRow>
  );
}

/**
 * Each row treats the submitted prompt as the primary object and shows the
 * routing decision beside the generation state that resulted from it.
 */
function CourseStartRequestRow({ request }: { request: ListedCourseStartRequest }) {
  return (
    <TableRow>
      <TableCell className="max-w-xl min-w-80 whitespace-normal">
        <p className="font-medium">{request.prompt}</p>
        <p className="text-muted-foreground text-xs uppercase">{request.language}</p>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="capitalize" variant="secondary">
            {request.scope}
          </Badge>
          {request.targetLanguage && <Badge variant="outline">{request.targetLanguage}</Badge>}
        </div>
      </TableCell>
      <TableCell className="max-w-sm whitespace-normal">
        {request.canonicalTitle ?? <span className="text-muted-foreground">No title</span>}
      </TableCell>
      <TableCell>
        <GenerationStatusBadge request={request} />
      </TableCell>
      <TableCell className="max-w-sm whitespace-normal">
        {request.course ? (
          <span>{request.course.title}</span>
        ) : (
          <span className="text-muted-foreground">No linked course</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(request.createdAt).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );
}

/**
 * Generation status is only present for requests that can enter the current
 * course-generation workflow. Other scopes are routed but not generated yet.
 */
function GenerationStatusBadge({ request }: { request: ListedCourseStartRequest }) {
  if (!request.generationStatus) {
    return <Badge variant="outline">No generation</Badge>;
  }

  return (
    <Badge className="capitalize" variant={getGenerationStatusVariant(request)}>
      {request.generationStatus}
    </Badge>
  );
}

/**
 * Failed statuses should stand out while completed, running, and pending states
 * remain quieter in a dense operational table.
 */
function getGenerationStatusVariant(request: ListedCourseStartRequest) {
  if (request.generationStatus === "failed") {
    return "destructive";
  }

  return "secondary";
}
