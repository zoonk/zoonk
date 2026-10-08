import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { listProvenanceCounts } from "@/data/ai/list-provenance-counts";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import { provenanceTableLabels } from "./_utils/ai-labels";

const columns: AdminTableColumn[] = [
  { label: "Table" },
  { label: "Model" },
  { label: "Prompt version" },
  { align: "right", label: "Rows" },
];

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
export async function ProvenanceSection({ days }: { days: number }) {
  return (
    <AdminSection
      description="Rows each model and prompt version wrote, per table."
      title="What each model wrote"
    >
      <ProvenanceTable days={days} />
    </AdminSection>
  );
}
