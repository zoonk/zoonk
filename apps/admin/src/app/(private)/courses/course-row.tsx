import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type ListedCourse } from "@/data/courses/list-courses";
import { TableCell } from "@zoonk/ui/components/table";

export function CourseRow({ course }: { course: ListedCourse }) {
  return (
    <AdminTableRow>
      <TableCell>
        <AdminTableRowLink className="block" href={`/courses/${course.id}`} prefetch>
          <span className="font-medium">{course.title}</span>
          <span className="text-muted-foreground block text-xs">{course.slug}</span>
        </AdminTableRowLink>
      </TableCell>
      <TableCell>{course.organization?.name ?? "—"}</TableCell>
      <TableCell className="uppercase">{course.language}</TableCell>
      <TableCell className="text-right tabular-nums">
        {course.chapterCount.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {course.writtenLessonCount.toLocaleString()}
      </TableCell>

      <TableCell>
        {course.isPublished ? (
          <span className="text-success-text">✓</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="text-muted-foreground">
        {new Date(course.createdAt).toLocaleDateString()}
      </TableCell>
    </AdminTableRow>
  );
}
