import { getUser } from "@/data/users/get-user";
import {
  type UserLearningKindStat,
  getUserLearningStats,
} from "@/data/users/get-user-learning-stats";
import { formatDuration } from "@/lib/format-duration";
import { getAdminLessonKindLabel } from "@/lib/lesson-label";
import { Separator } from "@zoonk/ui/components/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { DetailField } from "./detail-field";

const ENERGY_FORMATTER = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  trailingZeroDisplay: "stripIfInteger",
});

/**
 * The admin user detail page combines account progress with durable lesson
 * completion stats so support can answer learning-history questions in one view.
 */
export async function UserLesson({ userId }: { userId: string }) {
  const [user, learningStats] = await Promise.all([
    getUser(userId),
    getUserLearningStats({ userId }),
  ]);

  if (!user) {
    return null;
  }

  const { progress, members, _count } = user;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Learning</h3>
      <Separator />

      <dl className="mt-2">
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
    </section>
  );
}

/**
 * Energy is stored as a float, so display rounds to the single decimal place
 * admins can act on while hiding binary precision artifacts like 10.0000000002.
 */
function formatEnergyLevel(value: number) {
  return ENERGY_FORMATTER.format(value);
}

/**
 * The breakdown is hidden for learners with no completions so the section stays
 * compact while still showing the zero-value summary fields above.
 */
function LessonKindBreakdown({ rows }: { rows: UserLearningKindStat[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border">
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

/**
 * Formatting happens in the row so the table structure stays focused on
 * semantics and each duration column handles missing historical telemetry.
 */
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

/**
 * Null averages mean the learner completed that kind before duration data was
 * available, so an em dash is more honest than a zero-second lesson.
 */
function formatOptionalDuration(durationSeconds: number | null) {
  return durationSeconds === null ? "—" : formatDuration(durationSeconds);
}
