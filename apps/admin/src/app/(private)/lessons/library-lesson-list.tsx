import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { getVoteTotals, readVoteTotals } from "@/data/feedback/get-vote-totals";
import { listLibraryLessons } from "@/data/lessons/list-library-lessons";
import { type LibraryLessonStatus } from "@/lib/library-lesson-filters";
import { LibraryLessonRow } from "./library-lesson-row";

const LIBRARY_LESSON_COLUMNS: AdminTableColumn[] = [
  { label: "Lesson" },
  { label: "Course · home chapter" },
  { label: "Status" },
  { align: "right", label: "Screens" },
  { label: "Written by" },
  { label: "Votes" },
  { label: "Updated" },
];

/**
 * The Library lesson table for the URL's filters. Parsed primitives make deterministic private
 * cache entries for every filtered URL admins can prefetch.
 */
export async function LibraryLessonList({
  limit,
  model,
  offset,
  page,
  promptVersion,
  search,
  status,
}: {
  limit: number;
  model?: string;
  offset: number;
  page: number;
  promptVersion?: string;
  search?: string;
  status: LibraryLessonStatus;
}) {
  "use cache: private";

  const { lessons, total } = await listLibraryLessons({
    limit,
    model,
    offset,
    promptVersion,
    search,
    status,
  });

  const votes = await getVoteTotals({
    contentIds: lessons.map((lesson) => lesson.id),
    contentKind: "lesson",
  });

  return (
    <>
      <AdminTableColumns
        columns={LIBRARY_LESSON_COLUMNS}
        emptyLabel="No lessons found."
        isEmpty={lessons.length === 0}
      >
        {lessons.map((lesson) => (
          <LibraryLessonRow
            key={lesson.id}
            lesson={lesson}
            votes={readVoteTotals(votes, lesson.id)}
          />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/lessons"
        limit={limit}
        page={page}
        queryParams={{ model, promptVersion, status: status === "all" ? undefined : status }}
        search={search}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

/** Keeps the table footprint stable while the filtered rows stream in. */
export function LibraryLessonListSkeleton() {
  return <AdminTableColumnsSkeleton columns={LIBRARY_LESSON_COLUMNS} />;
}
