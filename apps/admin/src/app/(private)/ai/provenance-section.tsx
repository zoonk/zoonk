import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { listProvenanceCounts } from "@/data/ai/list-provenance-counts";
import { TableCell } from "@zoonk/ui/components/table";
import { provenanceTableLabels } from "./_utils/ai-labels";

const columns: AdminTableColumn[] = [
  { label: "What" },
  { label: "Model", size: "text" },
  { label: "Prompt version", size: "wide" },
  { align: "right", label: "How many" },
];

/** Which model and prompt version wrote what is in the Library and in learners' plans. */
export async function ProvenanceSection({ days }: { days: number }) {
  "use cache: private";

  const rows = await listProvenanceCounts(days);

  return (
    <AdminSection title={`What each model wrote, last ${days} days`}>
      <AdminTableColumns
        columns={columns}
        emptyLabel="Nothing was written by a model."
        isEmpty={rows.length === 0}
      >
        {rows.map((row) => (
          <AdminTableRow key={`${row.table}|${row.model}|${row.promptVersion}`}>
            <TableCell className="text-foreground font-medium">
              {provenanceTableLabels[row.table]}
            </TableCell>
            <TableCell>{row.model}</TableCell>
            <TableCell className="text-compact font-mono">{row.promptVersion}</TableCell>
            <TableCell numeric>{row.rows.toLocaleString("en")}</TableCell>
          </AdminTableRow>
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}
