import { AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { type LearnerMilestoneUser } from "@/data/stats/get-learner-milestones";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";

export function LearnerMilestoneUsersTable({
  emptyMessage,
  users,
}: {
  emptyMessage: string;
  users: LearnerMilestoneUser[];
}) {
  if (users.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <Table>
      <TableCaption className="sr-only">Learners matching the selected milestone</TableCaption>
      <LearnerMilestoneUsersTableHeader />

      <TableBody>
        {users.map((user) => (
          <LearnerMilestoneUserRow key={user.id} user={user} />
        ))}
      </TableBody>
    </Table>
  );
}

export function LearnerMilestoneUsersTableSkeleton() {
  return (
    <Table>
      <LearnerMilestoneUsersTableHeader />

      <AdminTableSkeletonRows>
        <LearnerMilestoneSkeletonRow />
      </AdminTableSkeletonRows>
    </Table>
  );
}

function LearnerMilestoneUsersTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>User</TableHead>
        <TableHead className="text-right">Lessons</TableHead>
        <TableHead className="text-right">Days</TableHead>
        <TableHead className="text-right">Brain Power</TableHead>
        <TableHead>Last completed</TableHead>
        <TableHead>Joined</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function LearnerMilestoneSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-10" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-10" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
    </TableRow>
  );
}

function LearnerMilestoneUserRow({ user }: { user: LearnerMilestoneUser }) {
  return (
    <TableRow>
      <TableCell>
        <Link className="block" href={`/users/${user.id}`} prefetch>
          <span className="font-medium">{user.name || "—"}</span>
          <span className="text-muted-foreground block text-xs">{user.email}</span>
        </Link>
      </TableCell>

      <TableCell className="text-right tabular-nums">
        {user.completedLessons.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {user.learningDays.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {user.totalBrainPower.toLocaleString()}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatLearnerDate(user.lastLearningDate)}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
    </TableRow>
  );
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString();
}

/** Learner-local dates are stored as UTC midnight, so UTC shows the day the learner saw. */
function formatLearnerDate(date: Date) {
  return new Date(date).toLocaleDateString(undefined, { timeZone: "UTC" });
}
