import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { listCliLoginsByPerson } from "@/data/cli-logins/list-cli-logins-by-person";
import { formatCount, formatDate } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { RevokeCliLoginsForm } from "./revoke-cli-logins-form";

const COLUMNS: AdminTableColumn[] = [
  { label: "Person" },
  { label: "Logged in on" },
  { label: "Last used" },
  { align: "right", label: "" },
];

export async function CliLoginList() {
  const people = await listCliLoginsByPerson();

  return (
    <AdminTableColumns
      columns={COLUMNS}
      emptyLabel="No one is logged in to the CLI."
      isEmpty={people.length === 0}
    >
      {people.map((person) => (
        <TableRow key={person.user.id}>
          <TableCell className="whitespace-normal">
            <Link
              className="font-medium underline-offset-3 hover:underline"
              href={`/users/${person.user.id}`}
              prefetch
            >
              {person.user.name}
            </Link>
            <div className="text-muted-foreground text-xs break-all">{person.user.email}</div>
          </TableCell>
          <TableCell>{formatCount(person.machines, "machine")}</TableCell>
          <TableCell className="text-muted-foreground">{formatDate(person.lastUsedAt)}</TableCell>
          <TableCell className="text-right">
            <RevokeCliLoginsForm name={person.user.name} userId={person.user.id} />
          </TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}

export function CliLoginListSkeleton() {
  return <AdminTableColumnsSkeleton columns={COLUMNS} />;
}
