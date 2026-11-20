import { AdminTableRowLink } from "@/components/admin-table-row";
import { TableCell } from "@zoonk/ui/components/table";
import Link from "next/link";

type Person = {
  email: string;
  isAnonymous?: boolean | null;
  name?: string | null;
  username?: string | null;
};

function personName(user: Person | null | undefined): string {
  if (!user) {
    return "Deleted user";
  }

  return user.isAnonymous ? "Guest" : user.name || user.username || "No name";
}

/**
 * A person in a table: their name over their email, opening their page. In a table about people
 * it is the row's link; where the row opens something else (`opensRow={false}`), only the cell's.
 */
export function AdminUserCell({
  className,
  note,
  opensRow = true,
  user,
  userId,
}: {
  className?: string;
  /** A state staff must not miss, after the name: "Banned". */
  note?: string | null | false;
  opensRow?: boolean;
  user: Person | null | undefined;
  userId: string;
}) {
  const UserLink = opensRow ? AdminTableRowLink : Link;

  return (
    <TableCell className={className}>
      <UserLink className="block" href={`/users/${userId}`} prefetch>
        <span className="block truncate font-medium">
          {personName(user)}
          {note ? (
            <span className="text-destructive-text text-xs font-normal"> · {note}</span>
          ) : null}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          {user && !user.isAnonymous ? user.email : "No email"}
        </span>
      </UserLink>
    </TableCell>
  );
}
