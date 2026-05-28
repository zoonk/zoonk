import {
  type UserStartedCourse,
  listUserStartedCourses,
} from "@/data/users/list-user-started-courses";
import { Separator } from "@zoonk/ui/components/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

/**
 * User details need the courses a learner actually started, ordered by the
 * course update timestamp so support can quickly find the freshest course rows.
 */
export async function UserCourses({ userId }: { userId: string }) {
  const courses = await listUserStartedCourses({ userId });

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Started courses</h3>
      <Separator />

      {courses.length > 0 ? (
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {courses.map((course) => (
                <UserCourseRow course={course} key={course.id} />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">No started courses.</p>
      )}
    </section>
  );
}

/**
 * Keeping the row renderer separate keeps the section focused on empty-state
 * vs table rendering, while the row owns the date and number formatting.
 */
function UserCourseRow({ course }: { course: UserStartedCourse }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{course.course.title}</TableCell>
      <TableCell>{course.course.organization?.name ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(course.course.updatedAt)}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(course.startedAt)}</TableCell>
    </TableRow>
  );
}

/**
 * Admin tables use a compact date-only display because the surrounding columns
 * already make the timestamp meaning clear.
 */
function formatDate(date: Date | null) {
  return date ? new Date(date).toLocaleDateString() : "—";
}
