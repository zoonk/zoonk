import { AdminTableSkeleton, AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
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

/**
 * The table focuses on the metrics that explain why each learner matched the
 * selected milestone, while the user name remains the link into account detail.
 */
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
    <div className="rounded-lg border">
      <Table>
        <TableCaption className="sr-only">Learners matching the selected milestone</TableCaption>
        <LearnerMilestoneUsersTableHeader />

        <TableBody>
          {users.map((user) => (
            <LearnerMilestoneUserRow key={user.id} user={user} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * The skeleton reuses the real header so column labels stay in one place while
 * placeholder rows mimic the loaded table body.
 */
export function LearnerMilestoneUsersTableSkeleton() {
  return (
    <AdminTableSkeleton>
      <Table>
        <LearnerMilestoneUsersTableHeader />

        <AdminTableSkeletonRows>
          <LearnerMilestoneSkeletonRow />
        </AdminTableSkeletonRows>
      </Table>
    </AdminTableSkeleton>
  );
}

/**
 * The loaded table and skeleton need identical columns. Sharing the header
 * avoids maintaining copy and alignment in two separate render paths.
 */
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

/**
 * A separate row component keeps the skeleton table readable without deep JSX
 * nesting in the fallback wrapper.
 */
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

/**
 * Rows make the user identity clickable and keep the milestone numbers aligned
 * for fast scanning across the two related completion metrics.
 */
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
      <TableCell className="text-muted-foreground">{formatDate(user.lastCompletedAt)}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
    </TableRow>
  );
}

/**
 * Admin tables use compact date-only formatting because the surrounding column
 * label already explains which timestamp is being shown.
 */
function formatDate(date: Date) {
  return new Date(date).toLocaleDateString();
}
