import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { AdminUserCell } from "@/components/admin-user-cell";
import { listCliLoginsByPerson } from "@/data/cli-logins/list-cli-logins-by-person";
import { formatCount, formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";
import { RevokeCliLoginsForm } from "./revoke-cli-logins-form";

const COLUMNS: AdminTableColumn[] = [
  { label: "Person", twoLines: true },
  { label: "Logged in on" },
  { label: "Last used" },
  { align: "right", label: "", size: "text" },
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
        <AdminTableRow key={person.user.id}>
          <AdminUserCell user={person.user} userId={person.user.id} />
          <TableCell>{formatCount(person.machines, "machine")}</TableCell>
          <TableCell className="text-muted-foreground">{formatDate(person.lastUsedAt)}</TableCell>
          <TableCell className="text-right">
            <RevokeCliLoginsForm name={person.user.name} userId={person.user.id} />
          </TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}

export function CliLoginListSkeleton() {
  return <AdminTableColumnsSkeleton columns={COLUMNS} />;
}
