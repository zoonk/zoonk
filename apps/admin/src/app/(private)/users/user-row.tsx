import { type listUsers } from "@/data/users/list-users";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

/**
 * The admin user list is ordered by Brain Power, so each row shows the score
 * that explains why the user appears in that position.
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

      <TableCell>
        <Badge variant={user.plan === "free" ? "secondary" : "outline"} className="capitalize">
          {user.plan}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
