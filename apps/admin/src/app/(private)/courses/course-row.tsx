import { type Course, type Organization } from "@zoonk/db";
import { TableCell, TableRow } from "@zoonk/ui/components/table";

const EDITOR_URL = process.env.NEXT_PUBLIC_EDITOR_APP_URL;

function getCourseUrl(course: Course & { organization: Organization | null }) {
  if (!course.organization) {
    return null;
  }

  return `${EDITOR_URL}/${course.organization.slug}/c/${course.language}/${course.slug}`;
}

export function CourseRow({ course }: { course: Course & { organization: Organization | null } }) {
  const courseUrl = getCourseUrl(course);

  return (
    <TableRow>
      <TableCell className="font-medium">
        {courseUrl ? (
          // oxlint-disable-next-line next/no-html-link-for-pages -- cross-app link
          <a href={courseUrl}>{course.title}</a>
        ) : (
          course.title
        )}
      </TableCell>
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
