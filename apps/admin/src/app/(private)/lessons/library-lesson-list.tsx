import { AdminNameCell } from "@/components/admin-name-cell";
import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
  emptyListLabel,
} from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { AdminPagination } from "@/components/pagination";
import { StateMark } from "@/components/state-mark";
import { type ListedLibraryLesson, listLibraryLessons } from "@/data/lessons/list-library-lessons";
import { formatCount, formatDate, toWords } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { type LibraryLessonStatus, libraryLessonStatusLabels } from "@/lib/library-lesson-filters";
import { TableCell } from "@zoonk/ui/components/table";

const columns: AdminTableColumn[] = [
  { label: "Lesson", twoLines: true },
  { label: "Course and chapter", size: "text", twoLines: true },
  { label: "State", size: "wide" },
  { align: "right", label: "Screens" },
  { label: "Updated" },
];

function LessonState({ lesson }: { lesson: ListedLibraryLesson }) {
  if (lesson.setAsideAt) {
    return <StateMark state="quarantined">Set aside</StateMark>;
  }

  return (
    <StateMark state={lesson.contentStatus}>
      {libraryLessonStatusLabels[lesson.contentStatus]}
    </StateMark>
  );
}

function LessonRow({ lesson }: { lesson: ListedLibraryLesson }) {
  const chapters = lesson._count.chapters;

  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/lessons/${lesson.id}`}
        note={[
          languageName(lesson.language),
          toWords(lesson.level),
          lesson.visibility === "private" && "Private",
        ]
          .filter(Boolean)
          .join(" · ")}
        title={lesson.title}
      />
      <TableCell>
        <span className="block truncate">{lesson.homeChapter?.homeCourse?.title}</span>
        <span className="block truncate text-xs">
          {lesson.homeChapter?.title ?? "No chapter"}
          {chapters > 1 ? ` · in ${formatCount(chapters, "chapter")}` : ""}
        </span>
      </TableCell>
      <TableCell>
        <LessonState lesson={lesson} />
      </TableCell>
      <TableCell numeric>{lesson._count.steps.toLocaleString("en")}</TableCell>
      <TableCell>{formatDate(lesson.updatedAt)}</TableCell>
    </AdminTableRow>
  );
}

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
        columns={columns}
        emptyLabel={emptyListLabel({ noun: "lessons", search })}
        isEmpty={lessons.length === 0}
      >
        {lessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} />
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
  return <AdminTableColumnsSkeleton columns={columns} />;
}
