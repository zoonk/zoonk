import { AdminNameCell } from "@/components/admin-name-cell";
import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { AdminTabs } from "@/components/admin-tabs";
import { StateMark } from "@/components/state-mark";
import { type ContentFixListItem, listContentFixes } from "@/data/content-fixes/list-content-fixes";
import { formatDate } from "@/lib/format";
import { readQueryParam } from "@/lib/query-param";
import { TableCell } from "@zoonk/ui/components/table";
import { contentFixStatusLabels, contentFixStatusTones } from "./content-fix-status";

type SearchParams = PageProps<"/content-fixes">["searchParams"];

const WAITING_COLUMNS: AdminTableColumn[] = [
  { label: "Fix", twoLines: true },
  { label: "Proposed by", size: "wide" },
  { label: "Proposed" },
];

const DECIDED_COLUMNS: AdminTableColumn[] = [
  { label: "Fix", twoLines: true },
  { label: "Decision", size: "wide" },
  { label: "Decided by", size: "wide" },
  { label: "Decided" },
];

async function readView(searchParams: SearchParams): Promise<"decided" | "waiting"> {
  const params = await searchParams;
  return readQueryParam(params.view) === "decided" ? "decided" : "waiting";
}

/** The queue first, with how many wait; what was decided is the other view. */
export async function ContentFixViews({ searchParams }: { searchParams: SearchParams }) {
  const [view, { pending }] = await Promise.all([readView(searchParams), listContentFixes()]);

  return (
    <AdminTabs
      label="Fixes"
      options={[
        {
          count: pending.length,
          href: "/content-fixes",
          isActive: view === "waiting",
          label: "Waiting",
        },
        { href: "/content-fixes?view=decided", isActive: view === "decided", label: "Decided" },
      ]}
    />
  );
}

/** What the fix says is wrong, over where it is. */
function FixCell({ fix }: { fix: ContentFixListItem }) {
  return (
    <AdminNameCell
      href={`/content-fixes/${fix.id}`}
      note={fix.location.trail.join(" › ") || "Content that was deleted"}
      title={fix.revertsId ? `Undo: ${fix.reason}` : fix.reason}
    />
  );
}

export async function ContentFixList({ searchParams }: { searchParams: SearchParams }) {
  const [view, { decided, pending }] = await Promise.all([
    readView(searchParams),
    listContentFixes(),
  ]);

  if (view === "decided") {
    return (
      <AdminTableColumns
        columns={DECIDED_COLUMNS}
        emptyLabel="No fix has been decided yet."
        isEmpty={decided.length === 0}
      >
        {decided.map((fix) => (
          <AdminTableRow key={fix.id}>
            <FixCell fix={fix} />
            <TableCell>
              <StateMark state={fix.status} tone={contentFixStatusTones[fix.status]}>
                {contentFixStatusLabels[fix.status]}
              </StateMark>
            </TableCell>
            <TableCell>{fix.decider?.name}</TableCell>
            <TableCell>{fix.decidedAt ? formatDate(fix.decidedAt) : null}</TableCell>
          </AdminTableRow>
        ))}
      </AdminTableColumns>
    );
  }

  return (
    <AdminTableColumns
      columns={WAITING_COLUMNS}
      emptyLabel="No fix is waiting for review."
      isEmpty={pending.length === 0}
    >
      {pending.map((fix) => (
        <AdminTableRow key={fix.id}>
          <FixCell fix={fix} />
          <TableCell>{fix.proposer?.name ?? "Deleted account"}</TableCell>
          <TableCell>{formatDate(fix.createdAt)}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}

export function ContentFixListSkeleton() {
  return <AdminTableColumnsSkeleton columns={WAITING_COLUMNS} />;
}
