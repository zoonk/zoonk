import { type ListedCourse } from "@/data/courses/list-courses";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

/**
 * The primary course identity links to its editor and keeps the current slug
 * visible so admins can verify URL changes directly from the catalog list.
 */
export function CourseRow({ course }: { course: ListedCourse }) {
  return (
    <TableRow>
      <TableCell>
        <Link className="block" href={`/courses/${course.id}`} prefetch>
          <span className="font-medium">{course.title}</span>
          <span className="text-muted-foreground block text-xs">{course.slug}</span>
        </Link>
      </TableCell>
      <TableCell>{course.organization?.name ?? "—"}</TableCell>
      <TableCell className="uppercase">{course.language}</TableCell>
      <TableCell className="text-right tabular-nums">
        {course.completedLessonCount.toLocaleString()}
      </TableCell>

      <TableCell>
        {course.isPublished ? (
          <span className="text-success">✓</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="text-muted-foreground">
        {new Date(course.createdAt).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );
}
