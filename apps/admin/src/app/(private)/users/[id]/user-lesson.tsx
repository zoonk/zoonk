import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { getUser } from "@/data/users/get-user";
import {
  type UserLearningKindStat,
  getUserLearningStats,
} from "@/data/users/get-user-learning-stats";
import { formatDuration } from "@/lib/format-duration";
import { getAdminLessonKindLabel } from "@/lib/lesson-label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

const ENERGY_FORMATTER = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  trailingZeroDisplay: "stripIfInteger",
});

export async function UserLesson({ userId }: { userId: string }) {
  "use cache: private";

  const [user, learningStats] = await Promise.all([getUser(userId), getUserLearningStats(userId)]);

  if (!user) {
    return null;
  }

  const { progress, members, _count } = user;

  return (
    <AdminSection title="Learning">
      <dl className="divide-y">
        <DetailField label="Brain power">
          {progress ? Number(progress.totalBrainPower).toLocaleString() : "0"}
        </DetailField>

        <DetailField label="Current energy">
          {formatEnergyLevel(progress?.currentEnergy ?? 0)}
        </DetailField>

        <DetailField label="Total learning time">
          {formatDuration(learningStats.totalLearningSeconds)}
        </DetailField>

        <DetailField label="Learning days">
          {learningStats.learningDays.toLocaleString()}
        </DetailField>

        <DetailField label="Completed lessons">
          {learningStats.completedLessons.toLocaleString()}
        </DetailField>

        <DetailField label="Last active">
          {progress?.lastActiveAt ? new Date(progress.lastActiveAt).toLocaleDateString() : "—"}
        </DetailField>

        <DetailField label="Courses owned">{_count.ownedCourses}</DetailField>

        <DetailField label="Organizations">
          {members.length > 0
            ? members.map((member) => `${member.organization.name} (${member.role})`).join(", ")
            : "—"}
        </DetailField>
      </dl>

      <LessonKindBreakdown rows={learningStats.lessonKinds} />
    </AdminSection>
  );
}

/** Energy is stored as a float, so it's rounded to hide artifacts like 10.0000000002. */
function formatEnergyLevel(value: number) {
  return ENERGY_FORMATTER.format(value);
}

function LessonKindBreakdown({ rows }: { rows: UserLearningKindStat[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lesson kind</TableHead>
            <TableHead className="text-right">Completed</TableHead>
            <TableHead className="text-right">Avg time</TableHead>
            <TableHead className="text-right">Total time</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <LessonKindBreakdownRow key={row.kind} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LessonKindBreakdownRow({ row }: { row: UserLearningKindStat }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{getAdminLessonKindLabel(row.kind)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {row.completedLessons.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatOptionalDuration(row.avgDurationSeconds)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatDuration(row.totalDurationSeconds)}
      </TableCell>
    </TableRow>
  );
}

function formatOptionalDuration(durationSeconds: number | null) {
  return durationSeconds === null ? "—" : formatDuration(durationSeconds);
}
