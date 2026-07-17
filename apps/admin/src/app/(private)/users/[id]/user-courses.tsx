import {
  type UserCompletedLessonCourse,
  listUserCompletedLessonCourses,
} from "@/data/users/list-user-completed-lesson-courses";
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
 * User details focus on courses where the learner completed lessons, ordered
 * by the most recent completion so support can scan recent learning context.
 */
export async function UserCourses({ userId }: { userId: string }) {
  "use cache: private";

  const courses = await listUserCompletedLessonCourses({ userId });

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Courses with completed lessons</h3>
      <Separator />

      {courses.length > 0 ? (
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Completed lessons</TableHead>
                <TableHead className="text-right">Completed chapters</TableHead>
                <TableHead>Last completed</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {courses.map((course) => (
                <UserCourseRow course={course} key={course.course.id} />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">No completed lessons yet.</p>
      )}
    </section>
  );
}

/**
 * Keeping the row renderer separate keeps the section focused on empty-state
 * vs table rendering, while the row owns the date and number formatting.
 */
function UserCourseRow({ course }: { course: UserCompletedLessonCourse }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{course.course.title}</TableCell>
      <TableCell className="text-right tabular-nums">
        {course.completedLessonCount.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {course.completedChapterCount.toLocaleString()}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(course.lastCompletedAt)}</TableCell>
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
