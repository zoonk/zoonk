import { AdminSection } from "@/components/admin-section";
import { BarList } from "@/components/bar-list";
import { listUserLessonKinds } from "@/data/users/get-user-learning-stats";
import { formatDuration } from "@/lib/format-duration";
import { getAdminLessonKindLabel } from "@/lib/lesson-label";

/** Which kinds of lesson they finish, most first, with the time each takes them. */
export async function UserLessonKinds({ userId }: { userId: string }) {
  "use cache: private";

  const kinds = await listUserLessonKinds(userId);

  if (kinds.length === 0) {
    return null;
  }

  return (
    <AdminSection title="Lessons completed, by kind">
      <BarList
        rows={kinds.map((row) => ({
          display: row.completedLessons.toLocaleString("en"),
          key: row.kind,
          name: getAdminLessonKindLabel(row.kind),
          note: [
            row.avgDurationSeconds === null
              ? null
              : `${formatDuration(row.avgDurationSeconds)} each`,
            `${formatDuration(row.totalDurationSeconds)} in all`,
          ]
            .filter(Boolean)
            .join(" · "),
          value: row.completedLessons,
        }))}
      />
    </AdminSection>
  );
}
