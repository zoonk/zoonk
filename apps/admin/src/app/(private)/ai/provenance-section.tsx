import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { listProvenanceCounts } from "@/data/ai/list-provenance-counts";
import { TableCell } from "@zoonk/ui/components/table";
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
      unsized
      columns={columns}
      emptyLabel={`No AI-written rows in the last ${days} days.`}
      isEmpty={rows.length === 0}
    >
      {rows.map((row) => (
        <AdminTableRow key={`${row.table}|${row.model}|${row.promptVersion}`}>
          <TableCell>{provenanceTableLabels[row.table]}</TableCell>
          <TableCell className="font-mono text-xs">{row.model}</TableCell>
          <TableCell className="font-mono text-xs">{row.promptVersion ?? "—"}</TableCell>
          <TableCell numeric>{row.rows.toLocaleString()}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}

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
