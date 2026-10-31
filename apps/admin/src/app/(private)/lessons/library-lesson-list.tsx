import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { listLibraryLessons } from "@/data/lessons/list-library-lessons";
import { type LibraryLessonStatus } from "@/lib/library-lesson-filters";
import { LibraryLessonRow } from "./library-lesson-row";

const LIBRARY_LESSON_COLUMNS: AdminTableColumn[] = [
  { label: "Lesson" },
  { label: "Course · home chapter" },
  { label: "Status" },
  { align: "right", label: "Screens" },
  { label: "Written by" },
  { label: "Updated" },
];

/** Primitive props make each filtered list its own cache entry. */
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

  return (
    <>
      <AdminTableColumns
        columns={LIBRARY_LESSON_COLUMNS}
        emptyLabel="No lessons found."
        isEmpty={lessons.length === 0}
      >
        {lessons.map((lesson) => (
          <LibraryLessonRow key={lesson.id} lesson={lesson} />
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

export function LibraryLessonListSkeleton() {
  return <AdminTableColumnsSkeleton columns={LIBRARY_LESSON_COLUMNS} />;
}
