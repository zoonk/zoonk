import { AdminPagination } from "@/components/pagination";
import { listGeneratedLessons } from "@/data/lessons/list-generated-lessons";
import { parseGeneratedLessonStatus } from "@/lib/generated-lesson-status";
import { parseSearchParams } from "@/lib/parse-search-params";
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
  const { lessons, total } = await listGeneratedLessons({ limit, offset, search, status });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
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
