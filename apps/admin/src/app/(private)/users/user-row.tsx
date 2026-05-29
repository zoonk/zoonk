import { type listUsers } from "@/data/users/list-users";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

/**
 * Admins can sort users by Brain Power or signup recency, so the row keeps both
 * values visible without making either sort mode require a separate detail page.
 */
export function UserRow({
  user,
}: {
  user: Awaited<ReturnType<typeof listUsers>>["users"][number];
}) {
  return (
    <TableRow>
      <TableCell>
        <Link className="block" href={`/users/${user.id}`}>
          <span className="font-medium">{user.name || "—"}</span>
          <span className="text-muted-foreground block text-xs">{user.email}</span>
        </Link>
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
    </TableRow>
  );
}
