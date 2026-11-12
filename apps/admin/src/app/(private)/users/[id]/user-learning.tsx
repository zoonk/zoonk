import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getUser } from "@/data/users/get-user";
import { getUserLearningStats } from "@/data/users/get-user-learning-stats";
import { formatDuration } from "@/lib/format-duration";
import { getAdminLessonKindLabel } from "@/lib/lesson-label";
import { TableCell } from "@zoonk/ui/components/table";

/** Energy is stored as a float, so it's rounded to hide artifacts like 10.0000000002. */
const ENERGY_FORMATTER = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  trailingZeroDisplay: "stripIfInteger",
});

const KIND_COLUMNS: AdminTableColumn[] = [
  { label: "Lesson kind" },
  { align: "right", label: "Completed" },
  { align: "right", label: "Average time" },
  { align: "right", label: "Total time" },
];

export async function UserLearning({ userId }: { userId: string }) {
  "use cache: private";

  const [user, stats] = await Promise.all([getUser(userId), getUserLearningStats(userId)]);

  if (!user) {
    return null;
  }

  return (
    <>
      <AdminSection title="Totals">
        <DetailFields>
          <DetailField label="Brain Power">
            {Number(user.progress?.totalBrainPower ?? 0).toLocaleString("en")}
          </DetailField>
          <DetailField label="Energy">
            {ENERGY_FORMATTER.format(user.progress?.currentEnergy ?? 0)}
          </DetailField>
          <DetailField label="Study time">{formatDuration(stats.totalLearningSeconds)}</DetailField>
          <DetailField label="Days studied">{stats.learningDays.toLocaleString("en")}</DetailField>
          <DetailField label="Lessons completed">
            {stats.completedLessons.toLocaleString("en")}
          </DetailField>
        </DetailFields>
      </AdminSection>

      {stats.lessonKinds.length > 0 ? (
        <AdminSection title="Lessons by kind">
          <AdminTableColumns columns={KIND_COLUMNS} emptyLabel="" isEmpty={false}>
            {stats.lessonKinds.map((row) => (
              <AdminTableRow key={row.kind}>
                <TableCell>{getAdminLessonKindLabel(row.kind)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.completedLessons.toLocaleString("en")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.avgDurationSeconds === null ? "—" : formatDuration(row.avgDurationSeconds)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDuration(row.totalDurationSeconds)}
                </TableCell>
              </AdminTableRow>
            ))}
          </AdminTableColumns>
        </AdminSection>
      ) : null}
    </>
  );
}
