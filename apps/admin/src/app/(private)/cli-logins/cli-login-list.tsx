import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { listActiveCliLogins } from "@/data/cli-logins/list-active-cli-logins";
import { formatDateTime } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { RevokeCliLoginForm } from "./revoke-cli-login-form";

const COLUMNS: AdminTableColumn[] = [
  { label: "Person" },
  { label: "Login" },
  { align: "right", label: "" },
];

export async function CliLoginList() {
  const logins = await listActiveCliLogins();

  return (
    <AdminTableColumns
      columns={COLUMNS}
      emptyLabel="No one is logged in to the CLI."
      isEmpty={logins.length === 0}
    >
      {logins.map((login) => (
        <TableRow key={login.id}>
          <TableCell className="whitespace-normal">
            <Link className="font-medium hover:underline" href={`/users/${login.user.id}`} prefetch>
              {login.user.name}
            </Link>
            <div className="text-muted-foreground text-xs break-all">{login.user.email}</div>
          </TableCell>
          <TableCell className="whitespace-normal">
            <div>{login.client.name ?? login.client.clientId}</div>
            <div className="text-muted-foreground text-xs">
              Renewed {formatDateTime(login.createdAt)}
            </div>
            <div className="text-muted-foreground text-xs">
              Ends {formatDateTime(login.expiresAt)} if unused
            </div>
          </TableCell>
          <TableCell className="text-right">
            <RevokeCliLoginForm loginId={login.id} person={login.user.name} />
          </TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}

export function CliLoginListSkeleton() {
  return <AdminTableColumnsSkeleton columns={COLUMNS} />;
}
