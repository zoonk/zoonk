import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { listPendingAccountDeletions } from "@/data/account-deletions/list-pending-account-deletions";
import { formatDateTime } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import { MarkAnalyticsRemovedForm } from "./mark-analytics-removed-form";

const COLUMNS: AdminTableColumn[] = [
  { label: "PostHog distinct id" },
  { label: "Deleted" },
  { align: "right", label: "" },
];

export async function AccountDeletionList() {
  const deletions = await listPendingAccountDeletions();

  return (
    <AdminTableColumns
      columns={COLUMNS}
      emptyLabel="No deleted accounts are waiting for their analytics to be removed."
      isEmpty={deletions.length === 0}
    >
      {deletions.map((deletion) => (
        <TableRow key={deletion.id}>
          <TableCell className="font-mono text-xs break-all select-all">
            {deletion.userId}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {formatDateTime(deletion.deletedAt)}
          </TableCell>
          <TableCell className="text-right">
            <MarkAnalyticsRemovedForm deletionId={deletion.id} />
          </TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}

export function AccountDeletionListSkeleton() {
  return <AdminTableColumnsSkeleton columns={COLUMNS} />;
}
