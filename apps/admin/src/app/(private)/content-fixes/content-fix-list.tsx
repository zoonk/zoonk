import { AdminSection, AdminSectionSkeleton } from "@/components/admin-section";
import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type ContentFixListItem, listContentFixes } from "@/data/content-fixes/list-content-fixes";
import { formatDateTime } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";
import Link from "next/link";
import { ContentFixStatusBadge, contentFixState } from "./content-fix-status";

const PENDING_COLUMNS: AdminTableColumn[] = [
  { label: "Fix" },
  { label: "Where" },
  { label: "Proposed" },
];

const DECIDED_COLUMNS: AdminTableColumn[] = [...PENDING_COLUMNS, { label: "Decision" }];

function ContentFixRow({ fix, withDecision }: { fix: ContentFixListItem; withDecision: boolean }) {
  return (
    <AdminTableRow>
      <TableCell className="max-w-96 min-w-56 whitespace-normal">
        <AdminTableRowLink className="block font-medium" href={`/content-fixes/${fix.id}`} prefetch>
          <span className="line-clamp-2">
            {fix.revertsId ? "Revert: " : ""}
            {fix.reason}
          </span>
        </AdminTableRowLink>
        {fix.batchSize > 1 && (
          <Link
            className="text-muted-foreground relative text-xs hover:underline"
            href={`/content-fixes/batches/${fix.batchId}`}
            prefetch
          >
            One of {fix.batchSize} proposed together
          </Link>
        )}
      </TableCell>
      <TableCell className="max-w-80 min-w-48 text-xs whitespace-normal">
        {fix.location.trail.join(" › ") || "Deleted content"}
      </TableCell>
      <TableCell className="text-xs">
        <div>{formatDateTime(fix.createdAt)}</div>
        <div className="text-muted-foreground">{fix.proposer?.name ?? "Deleted account"}</div>
      </TableCell>
      {withDecision && (
        <TableCell className="text-xs">
          <ContentFixStatusBadge state={contentFixState(fix)} />
          <div className="text-muted-foreground mt-1">
            {[formatDateTime(fix.decidedAt), fix.decider?.name].filter(Boolean).join(" · ")}
          </div>
        </TableCell>
      )}
    </AdminTableRow>
  );
}

export async function ContentFixList() {
  const { decided, pending } = await listContentFixes();

  return (
    <>
      <AdminSection title="Waiting for review">
        <AdminTableColumns
          columns={PENDING_COLUMNS}
          emptyLabel="No fix is waiting for review."
          isEmpty={pending.length === 0}
        >
          {pending.map((fix) => (
            <ContentFixRow fix={fix} key={fix.id} withDecision={false} />
          ))}
        </AdminTableColumns>
      </AdminSection>

      <AdminSection title="Decided">
        <AdminTableColumns
          columns={DECIDED_COLUMNS}
          emptyLabel="No fix has been decided yet."
          isEmpty={decided.length === 0}
        >
          {decided.map((fix) => (
            <ContentFixRow fix={fix} key={fix.id} withDecision />
          ))}
        </AdminTableColumns>
      </AdminSection>
    </>
  );
}

export function ContentFixListSkeleton() {
  return (
    <>
      <AdminSectionSkeleton>
        <AdminTableColumnsSkeleton columns={PENDING_COLUMNS} />
      </AdminSectionSkeleton>
      <AdminSectionSkeleton>
        <AdminTableColumnsSkeleton columns={DECIDED_COLUMNS} />
      </AdminSectionSkeleton>
    </>
  );
}
