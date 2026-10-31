import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type listUsers } from "@/data/users/list-users";
import { Badge } from "@zoonk/ui/components/badge";
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
          <span className="font-medium">{user.name || "—"}</span>
          <span className="text-muted-foreground block text-xs">{user.email}</span>
        </AdminTableRowLink>
      </TableCell>

      <TableCell>{user.username || "—"}</TableCell>

      <TableCell className="text-right tabular-nums">
        {Number(user.progress?.totalBrainPower ?? 0).toLocaleString()}
      </TableCell>

      <TableCell className="text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString()}
      </TableCell>

      <TableCell>
        <Badge variant={user.plan === "free" ? "secondary" : "outline"} className="capitalize">
          {user.plan}
        </Badge>
      </TableCell>
    </AdminTableRow>
  );
}
