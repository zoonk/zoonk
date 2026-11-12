import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
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
      <TableCell>
        <AdminTableRowLink className="block" href={`/users/${user.id}`} prefetch>
          <span className="font-medium">{user.name || user.username || "No name"}</span>
          {user.banned ? <span className="text-destructive-text text-xs"> · Banned</span> : null}
          <span className="text-muted-foreground block text-xs">{user.email}</span>
        </AdminTableRowLink>
      </TableCell>

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
