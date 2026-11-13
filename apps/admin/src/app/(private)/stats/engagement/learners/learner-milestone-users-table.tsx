import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { AdminUserCell } from "@/components/admin-user-cell";
import { type LearnerMilestoneUser } from "@/data/stats/get-learner-milestones";
import { formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";

const COLUMNS: AdminTableColumn[] = [
  { label: "User" },
  { align: "right", label: "Lessons" },
  { align: "right", label: "Days" },
  { align: "right", label: "Brain Power" },
  { label: "Last completed" },
  { label: "Joined" },
];

export function LearnerMilestoneUsersTable({
  emptyMessage,
  users,
}: {
  emptyMessage: string;
  users: LearnerMilestoneUser[];
}) {
  return (
    <AdminTableColumns columns={COLUMNS} emptyLabel={emptyMessage} isEmpty={users.length === 0}>
      {users.map((user) => (
        <LearnerMilestoneUserRow key={user.id} user={user} />
      ))}
    </AdminTableColumns>
  );
}

export function LearnerMilestoneUsersTableSkeleton() {
  return <AdminTableColumnsSkeleton columns={COLUMNS} />;
}

function LearnerMilestoneUserRow({ user }: { user: LearnerMilestoneUser }) {
  return (
    <AdminTableRow>
      <AdminUserCell user={user} userId={user.id} />

      <TableCell className="text-right tabular-nums">
        {user.completedLessons.toLocaleString("en")}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {user.learningDays.toLocaleString("en")}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {user.totalBrainPower.toLocaleString("en")}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatLearnerDate(user.lastLearningDate)}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
    </AdminTableRow>
  );
}

/** Learner-local dates are stored as UTC midnight, so UTC shows the day the learner saw. */
function formatLearnerDate(date: Date) {
  return new Date(date).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" });
}
