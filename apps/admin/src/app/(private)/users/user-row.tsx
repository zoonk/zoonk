import { TableCell, TableRow } from "@zoonk/ui/components/table";
import type { UserWithRole } from "better-auth/plugins";

type UserRowProps = {
  user: UserWithRole;
};

export function UserRow({ user }: UserRowProps) {
  return (
    <TableRow key={user.id}>
      <TableCell className="font-medium">{user.name || "—"}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell className="capitalize">{user.role || "user"}</TableCell>

      <TableCell>
        {user.emailVerified ? (
          <span className="text-success">✓</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell>
        {user.banned ? (
          <span className="text-destructive">Yes</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );
}
