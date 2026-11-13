import { AdminTableRow } from "@/components/admin-table-row";
import { AdminUserCell } from "@/components/admin-user-cell";
import { type listUsers } from "@/data/users/list-users";
import { capitalize, formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";

export function UserRow({
  user,
}: {
  user: Awaited<ReturnType<typeof listUsers>>["users"][number];
}) {
  return (
    <AdminTableRow>
      <AdminUserCell note={user.banned && "Banned"} user={user} userId={user.id} />

      <TableCell className={user.plan === "free" ? "text-muted-foreground" : ""}>
        {capitalize(user.plan)}
      </TableCell>

      <TableCell className="text-right tabular-nums">
        {Number(user.progress?.totalBrainPower ?? 0).toLocaleString("en")}
      </TableCell>

      <TableCell className="text-muted-foreground">
        {user.progress ? formatDate(user.progress.lastActiveAt) : "Never"}
      </TableCell>

      <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
    </AdminTableRow>
  );
}
