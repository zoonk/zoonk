import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import {
  type GenerationFailure,
  STUCK_RUNNING_MINUTES,
  getGenerationFailures,
} from "@/data/ai/get-generation-failures";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";
import { generationWorkflowLabels, getGenerationFailureHref } from "./_utils/ai-labels";

type FailureCount = Awaited<ReturnType<typeof getGenerationFailures>>["counts"][number];

const countColumns: AdminTableColumn[] = [
  { label: "Workflow" },
  { align: "right", label: "Failed" },
  { align: "right", label: `Running over ${STUCK_RUNNING_MINUTES} min` },
];

const latestColumns: AdminTableColumn[] = [
  { label: "Workflow" },
  { label: "Content" },
  { label: "State" },
  { label: "Updated" },
];

function FailureCountRow({ count }: { count: FailureCount }) {
  return (
    <TableRow>
      <TableCell>{generationWorkflowLabels[count.workflow]}</TableCell>
      <TableCell className={cn("text-right tabular-nums", count.failed > 0 && "text-destructive")}>
        {count.failed.toLocaleString()}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", count.stuck > 0 && "text-destructive")}>
        {count.stuck.toLocaleString()}
      </TableCell>
    </TableRow>
  );
}

function FailureLabel({ failure }: { failure: GenerationFailure }) {
  const href = getGenerationFailureHref(failure);
  const label = failure.label || "Untitled";

  if (!href) {
    return <span className="line-clamp-1">{label}</span>;
  }

  return (
    <Link className="line-clamp-1 hover:underline" href={href} prefetch>
      {label}
    </Link>
  );
}

function LatestFailureRow({ failure }: { failure: GenerationFailure }) {
  return (
    <TableRow>
      <TableCell>{generationWorkflowLabels[failure.workflow]}</TableCell>
      <TableCell className="max-w-80 min-w-48 whitespace-normal">
        <FailureLabel failure={failure} />
      </TableCell>
      <TableCell>
        <Badge variant={failure.status === "failed" ? "destructive" : "secondary"}>
          {failure.status === "failed" ? "Failed" : "Stuck running"}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {formatDateTime(failure.updatedAt)}
      </TableCell>
    </TableRow>
  );
}

/** Failed and stuck generation runs by workflow, with the latest ones to open and retry. */
export async function GenerationFailuresSection() {
  "use cache: private";

  const { counts, latest } = await getGenerationFailures();

  return (
    <AdminSection
      description={`Rows whose generation failed, or still running after ${STUCK_RUNNING_MINUTES} minutes.`}
      title="Generation failures"
    >
      <div className="flex flex-col gap-4">
        <AdminTableColumns columns={countColumns} emptyLabel="" isEmpty={false}>
          {counts.map((count) => (
            <FailureCountRow count={count} key={count.workflow} />
          ))}
        </AdminTableColumns>

        <AdminTableColumns
          columns={latestColumns}
          emptyLabel="No failed or stuck generations."
          isEmpty={latest.length === 0}
        >
          {latest.map((failure) => (
            <LatestFailureRow failure={failure} key={`${failure.workflow}|${failure.id}`} />
          ))}
        </AdminTableColumns>
      </div>
    </AdminSection>
  );
}
