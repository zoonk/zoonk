import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { ProvenanceLine } from "@/components/provenance";
import { getItem } from "@/data/items/get-item";
import { formatDate } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";

const EXPLANATION_COLUMNS: AdminTableColumn[] = [
  { label: "Answer" },
  { label: "Explanation" },
  { label: "Language" },
  { label: "Provenance" },
  { label: "Created" },
];

/**
 * Shared explanations of wrong typed or spoken answers, reused by the next learner who gives them.
 * Each row shows the explanation's provenance.
 */
export async function ItemExplanations({ itemId }: { itemId: string }) {
  "use cache: private";

  const item = await getItem(itemId);
  const explanations = item?.answerExplanations ?? [];

  return (
    <AdminSection title={`Answer explanations (${explanations.length})`}>
      <AdminTableColumns
        columns={EXPLANATION_COLUMNS}
        emptyLabel="No wrong answer has been explained yet."
        isEmpty={explanations.length === 0}
      >
        {explanations.map((explanation) => (
          <TableRow key={explanation.id}>
            <TableCell className="max-w-56 min-w-40 font-mono text-xs whitespace-normal">
              {explanation.normalizedAnswer}
            </TableCell>
            <TableCell className="max-w-120 min-w-72 whitespace-normal">
              {explanation.explanation}
            </TableCell>
            <TableCell className="uppercase">{explanation.language}</TableCell>
            <TableCell>
              <ProvenanceLine provenance={explanation} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(explanation.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}
