import { AdminPagination } from "@/components/pagination";
import {
  type ListedCourseSuggestionPrompt,
  listCourseSuggestionPrompts,
} from "@/data/course-suggestions/list-course-suggestion-prompts";
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
const TABLE_COLUMN_COUNT = 5;

type SuggestedCourse = ListedCourseSuggestionPrompt["suggestions"][number]["courseSuggestion"];

/**
 * The list is server-rendered so admins can refresh/share a filtered page and
 * still see private prompt data without adding client-side data fetching.
 */
export async function CourseSuggestionPromptList({
  searchParams,
}: {
  searchParams: PageProps<"/course-suggestions">["searchParams"];
}) {
  const { page, limit, offset, search } = parseSearchParams(await searchParams);
  const { prompts, total } = await listCourseSuggestionPrompts({ limit, offset, search });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {total.toLocaleString()} submitted {total === 1 ? "prompt" : "prompts"}.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <CourseSuggestionPromptTableHeader />

          <TableBody>
            {prompts.length > 0 ? (
              prompts.map((prompt) => <CourseSuggestionPromptRow key={prompt.id} prompt={prompt} />)
            ) : (
              <CourseSuggestionPromptEmptyRow />
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath="/course-suggestions"
        limit={limit}
        page={page}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}

/**
 * The fallback mirrors the loaded table structure so the page does not shift
 * from a blank area into a dense operational table once the query resolves.
 */
export function CourseSuggestionPromptListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-40" />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <CourseSuggestionPromptTableHeader />

          <TableBody>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- Skeleton rows are fixed placeholders.
              <CourseSuggestionPromptSkeletonRow key={index} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * The loaded and skeleton tables share column labels because prompt auditing
 * depends on stable column meaning more than custom loading presentation.
 */
function CourseSuggestionPromptTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Prompt</TableHead>
        <TableHead>Language</TableHead>
        <TableHead className="text-right">Suggestions</TableHead>
        <TableHead>Suggested Courses</TableHead>
        <TableHead>Submitted</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/**
 * Empty rows stay inside the table so a search with no matches keeps the same
 * layout as the submitted-prompt log.
 */
function CourseSuggestionPromptEmptyRow() {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>
        No course suggestion prompts found.
      </TableCell>
    </TableRow>
  );
}

/**
 * A row-sized placeholder keeps the suggestion column from collapsing during
 * streaming, which makes the loading state match the eventual dense table.
 */
function CourseSuggestionPromptSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-72" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-10" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-8" />
      </TableCell>
      <TableCell>
        <div className="flex min-w-96 flex-col gap-3">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-5 w-48" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
    </TableRow>
  );
}

/**
 * Each prompt row treats the original learner text as the primary object and
 * nests suggested courses beneath it, matching how prompts own suggestion
 * ordering in the database.
 */
function CourseSuggestionPromptRow({ prompt }: { prompt: ListedCourseSuggestionPrompt }) {
  return (
    <TableRow>
      <TableCell className="max-w-xl min-w-80 whitespace-normal">
        <p className="font-medium">{prompt.prompt}</p>
      </TableCell>
      <TableCell className="uppercase">{prompt.language}</TableCell>
      <TableCell className="text-right tabular-nums">
        {prompt.suggestions.length.toLocaleString()}
      </TableCell>
      <TableCell className="whitespace-normal">
        <SuggestedCourseList suggestions={prompt.suggestions} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(prompt.createdAt).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );
}

/**
 * Prompts can exist before suggestions are attached, so the suggestion column
 * needs an explicit empty state instead of rendering a visually blank cell.
 */
function SuggestedCourseList({
  suggestions,
}: {
  suggestions: ListedCourseSuggestionPrompt["suggestions"];
}) {
  if (suggestions.length === 0) {
    return <span className="text-muted-foreground">No suggested courses.</span>;
  }

  return (
    <div className="flex min-w-96 flex-col divide-y">
      {suggestions.map(({ courseSuggestion }) => (
        <SuggestedCourseItem course={courseSuggestion} key={courseSuggestion.id} />
      ))}
    </div>
  );
}

/**
 * Suggested courses keep the learner-facing title beside generation state so
 * admins can quickly see which suggestions became courses.
 */
function SuggestedCourseItem({ course }: { course: SuggestedCourse }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{course.title}</span>
        <GenerationStatusBadge course={course} />
        {course.targetLanguage && <Badge variant="outline">{course.targetLanguage}</Badge>}
      </div>

      {course.course && (
        <p className="text-muted-foreground text-xs">Generated course: {course.course.title}</p>
      )}
    </div>
  );
}

/**
 * Generation status is still useful operational context, especially when a
 * suggestion has not produced a course because it is pending or failed.
 */
function GenerationStatusBadge({ course }: { course: SuggestedCourse }) {
  return (
    <Badge className="capitalize" variant={getGenerationStatusVariant(course)}>
      {course.generationStatus}
    </Badge>
  );
}

/**
 * Failed statuses should stand out while completed and pending states remain
 * quieter in a dense operational table.
 */
function getGenerationStatusVariant(course: SuggestedCourse) {
  if (course.generationStatus === "failed") {
    return "destructive";
  }

  return "secondary";
}
