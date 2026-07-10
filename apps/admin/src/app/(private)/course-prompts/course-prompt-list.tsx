import { AdminPagination } from "@/components/pagination";
import {
  type ListedCoursePrompt,
  listCoursePrompts,
} from "@/data/course-prompts/list-course-prompts";
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
const TABLE_COLUMN_COUNT = 7;

/**
 * The list is server-rendered so admins can refresh/share a filtered page and
 * still inspect private prompt routing decisions without client-side fetching.
 */
export async function CoursePromptList({
  searchParams,
}: {
  searchParams: PageProps<"/course-prompts">["searchParams"];
}) {
  const { page, limit, offset, search } = parseSearchParams(await searchParams);
  const { prompts, total } = await listCoursePrompts({ limit, offset, search });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {total.toLocaleString()} submitted {total === 1 ? "prompt" : "prompts"}.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <CoursePromptTableHeader />

          <TableBody>
            {prompts.length > 0 ? (
              prompts.map((prompt) => <CoursePromptRow key={prompt.id} prompt={prompt} />)
            ) : (
              <CoursePromptEmptyRow />
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath="/course-prompts"
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
export function CoursePromptListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-40" />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <CoursePromptTableHeader />

          <TableBody>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- Skeleton rows are fixed placeholders.
              <CoursePromptSkeletonRow key={index} />
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
function CoursePromptTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Prompt</TableHead>
        <TableHead>Prompt Intent</TableHead>
        <TableHead>Course Format</TableHead>
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
 * as the full prompt log.
 */
function CoursePromptEmptyRow() {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>
        No course prompts found.
      </TableCell>
    </TableRow>
  );
}

/**
 * Row-sized placeholders keep the table columns stable during streaming.
 */
function CoursePromptSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-72" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-24" />
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
function CoursePromptRow({ prompt }: { prompt: ListedCoursePrompt }) {
  return (
    <TableRow>
      <TableCell className="max-w-xl min-w-80 whitespace-normal">
        <p className="font-medium">{prompt.prompt}</p>
        <p className="text-muted-foreground text-xs uppercase">{prompt.language}</p>
      </TableCell>
      <TableCell>
        <Badge className="capitalize" variant="secondary">
          {prompt.intent}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          {prompt.courseFormat ? (
            <Badge className="capitalize" variant="outline">
              {prompt.courseFormat}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">No course format</span>
          )}
          {prompt.targetLanguage && <Badge variant="outline">{prompt.targetLanguage}</Badge>}
        </div>
      </TableCell>
      <TableCell className="max-w-sm whitespace-normal">
        {prompt.canonicalTitle ?? <span className="text-muted-foreground">No title</span>}
      </TableCell>
      <TableCell>
        <GenerationStatusBadge prompt={prompt} />
      </TableCell>
      <TableCell className="max-w-sm whitespace-normal">
        {prompt.course ? (
          <span>{prompt.course.title}</span>
        ) : (
          <span className="text-muted-foreground">No linked course</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(prompt.createdAt).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );
}

/**
 * Generation status is only present for prompts that can enter the current
 * course-generation workflow. Other prompt classifications are routed but not generated yet.
 */
function GenerationStatusBadge({ prompt }: { prompt: ListedCoursePrompt }) {
  if (!prompt.generationStatus) {
    return <Badge variant="outline">No generation</Badge>;
  }

  return (
    <Badge className="capitalize" variant={getGenerationStatusVariant(prompt)}>
      {prompt.generationStatus}
    </Badge>
  );
}

/**
 * Failed statuses should stand out while completed, running, and pending states
 * remain quieter in a dense operational table.
 */
function getGenerationStatusVariant(prompt: ListedCoursePrompt) {
  if (prompt.generationStatus === "failed") {
    return "destructive";
  }

  return "secondary";
}
