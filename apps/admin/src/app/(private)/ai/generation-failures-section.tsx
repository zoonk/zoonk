import { AdminToolbar } from "@/components/admin-page";
import { AdminSectionEmpty } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { AdminTabs } from "@/components/admin-tabs";
import { StateMark } from "@/components/state-mark";
import {
  type GenerationFailure,
  LATEST_FAILURES_PER_WORKFLOW,
  getGenerationFailures,
} from "@/data/ai/get-generation-failures";
import { formatCount, formatDateTime } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { sumOf } from "@zoonk/utils/number";
import { generationWorkflowLabels, getGenerationFailureHref } from "./_utils/ai-labels";

const columns: AdminTableColumn[] = [
  { label: "What was being written" },
  { label: "Kind", size: "wide" },
  { label: "State", size: "wide" },
  { label: "Updated", size: "text" },
];

function FailureLabel({ failure }: { failure: GenerationFailure }) {
  const href = getGenerationFailureHref(failure);
  const label = failure.label || "Untitled";

  if (!href) {
    return label;
  }

  return (
    <AdminTableRowLink href={href} prefetch>
      {label}
    </AdminTableRowLink>
  );
}

function FailureState({ failure, now }: { failure: GenerationFailure; now: number }) {
  if (failure.status === "failed") {
    return <StateMark state="failed" />;
  }

  const days = Math.floor((now - failure.updatedAt.getTime()) / MS_PER_DAY);

  return (
    <StateMark state="stuck">
      {days > 0 ? `Stuck for ${formatCount(days, "day")}` : "Stuck today"}
    </StateMark>
  );
}

/**
 * What failed to be written, or started and never finished, newest first. A kind's view keeps its
 * count; a kind with nothing wrong has no view.
 */
export async function GenerationFailuresSection({ kind }: { kind: string | undefined }) {
  "use cache: private";

  const { counts, latest } = await getGenerationFailures();
  const kinds = counts.filter((row) => row.failed + row.stuck > 0);
  const current = kinds.find((row) => row.workflow === kind);
  const rows = current ? latest.filter((row) => row.workflow === current.workflow) : latest;
  const all = sumOf(kinds.map((row) => row.failed + row.stuck));
  const total = current ? current.failed + current.stuck : all;
  // oxlint-disable-next-line react/purity -- A cached Server Component reads the time once per cache entry and never re-renders on the client.
  const now = Date.now();

  if (kinds.length === 0) {
    return <AdminSectionEmpty>Nothing failed and nothing is stuck.</AdminSectionEmpty>;
  }

  return (
    <>
      <AdminToolbar>
        <AdminTabs
          label="Kind"
          options={[
            { count: all, href: "/ai?tab=failed", isActive: !current, label: "All" },
            ...kinds.map((row) => ({
              count: row.failed + row.stuck,
              href: `/ai?tab=failed&kind=${row.workflow}`,
              isActive: row.workflow === current?.workflow,
              label: generationWorkflowLabels[row.workflow],
            })),
          ]}
        />
      </AdminToolbar>

      <div className="flex flex-col gap-3">
        <AdminTableColumns columns={columns} emptyLabel="" isEmpty={false}>
          {rows.map((failure) => (
            <AdminTableRow key={`${failure.workflow}|${failure.id}`}>
              <TableCell className="text-foreground font-medium">
                <FailureLabel failure={failure} />
              </TableCell>
              <TableCell>{generationWorkflowLabels[failure.workflow]}</TableCell>
              <TableCell>
                <FailureState failure={failure} now={now} />
              </TableCell>
              <TableCell>{formatDateTime(failure.updatedAt)}</TableCell>
            </AdminTableRow>
          ))}
        </AdminTableColumns>
        {rows.length < total ? (
          <p className="text-muted-foreground text-compact">
            The newest {LATEST_FAILURES_PER_WORKFLOW} of each kind, of {total.toLocaleString("en")}.
          </p>
        ) : null}
      </div>
    </>
  );
}
