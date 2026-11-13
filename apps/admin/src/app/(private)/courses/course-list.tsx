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
import { type ListedCourse, listCourses } from "@/data/courses/list-courses";
import { languageName } from "@/lib/language-filter";
import { parseSearchParams } from "@/lib/parse-search-params";
import { TableCell } from "@zoonk/ui/components/table";

const columns: AdminTableColumn[] = [
  { label: "Course", twoLines: true },
  { label: "Language" },
  { align: "right", label: "Chapters" },
  { align: "right", label: "Lessons written", size: "wide" },
  { label: "Learners see it", size: "wide" },
];

function CourseRow({ course }: { course: ListedCourse }) {
  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/courses/${course.id}`}
        note={course.organization?.name ?? course.slug}
        title={course.title}
      />
      <TableCell>{languageName(course.language)}</TableCell>
      <TableCell numeric>{course.chapterCount.toLocaleString("en")}</TableCell>
      <TableCell numeric>{course.writtenLessonCount.toLocaleString("en")}</TableCell>
      <TableCell>
        {course.isPublished ? (
          <StateMark state="completed">Published</StateMark>
        ) : (
          <StateMark state="archived">Hidden</StateMark>
        )}
      </TableCell>
    </AdminTableRow>
  );
}

export async function CourseList({
  searchParams,
}: {
  searchParams: PageProps<"/courses">["searchParams"];
}) {
  const { page, limit, offset, search } = parseSearchParams(await searchParams);

  return <CachedCourseList limit={limit} offset={offset} page={page} search={search} />;
}

/** Primitive props make each list state its own cache entry. */
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

  return (
    <>
      <AdminTableColumns
        columns={columns}
        emptyLabel={emptyListLabel({ noun: "courses", search })}
        isEmpty={courses.length === 0}
      >
        {courses.map((course) => (
          <CourseRow course={course} key={course.id} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/courses"
        limit={limit}
        page={page}
        search={search}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function CourseListSkeleton() {
  return <AdminTableColumnsSkeleton columns={columns} />;
}
