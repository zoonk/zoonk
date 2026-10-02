import { AdminFilterNav } from "@/components/admin-filter-nav";
import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { listProvenanceCounts } from "@/data/ai/list-provenance-counts";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import { provenanceTableLabels } from "./_utils/ai-labels";
import { aiPeriodDays, parseAiPeriodDays } from "./_utils/ai-period";

const columns: AdminTableColumn[] = [
  { label: "Table" },
  { label: "Model" },
  { label: "Prompt version" },
  { align: "right", label: "Rows" },
];

function PeriodFilter({ days }: { days: number }) {
  return (
    <AdminFilterNav
      label="Period"
      options={aiPeriodDays.map((period) => ({
        href: `/ai?days=${period}`,
        isActive: period === days,
        label: `${period} days`,
      }))}
    />
  );
}

async function ProvenanceTable({ days }: { days: number }) {
  "use cache: private";

  const rows = await listProvenanceCounts(days);

  return (
    <AdminTableColumns
      columns={columns}
      emptyLabel={`No AI-written rows in the last ${days} days.`}
      isEmpty={rows.length === 0}
    >
      {rows.map((row) => (
        <TableRow key={`${row.table}|${row.model}|${row.promptVersion}`}>
          <TableCell>{provenanceTableLabels[row.table]}</TableCell>
          <TableCell className="font-mono text-xs">{row.model}</TableCell>
          <TableCell className="font-mono text-xs">{row.promptVersion ?? "—"}</TableCell>
          <TableCell className="text-right tabular-nums">{row.rows.toLocaleString()}</TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}

/** What each model and prompt version wrote, read from the provenance on every Library row. */
export async function ProvenanceSection({
  searchParams,
}: {
  searchParams: PageProps<"/ai">["searchParams"];
}) {
  const params = await searchParams;
  const days = parseAiPeriodDays(params.days);

  return (
    <AdminSection
      action={<PeriodFilter days={days} />}
      description="Rows each model and prompt version wrote, per table."
      title="What each model wrote"
    >
      <ProvenanceTable days={days} />
    </AdminSection>
  );
}
