import { type Course, type Organization } from "@zoonk/db";
import { TableCell, TableRow } from "@zoonk/ui/components/table";

export function CourseRow({ course }: { course: Course & { organization: Organization | null } }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{course.title}</TableCell>
      <TableCell>{course.organization?.name ?? "—"}</TableCell>
      <TableCell className="uppercase">{course.language}</TableCell>

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
