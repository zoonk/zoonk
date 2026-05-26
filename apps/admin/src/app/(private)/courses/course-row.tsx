import { type ListedCourse } from "@/data/courses/list-courses";
import { TableCell, TableRow } from "@zoonk/ui/components/table";

export function CourseRow({ course }: { course: ListedCourse }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{course.title}</TableCell>
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
