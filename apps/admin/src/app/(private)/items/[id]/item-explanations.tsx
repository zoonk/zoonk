import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { getItem } from "@/data/items/get-item";
import { formatDate } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { TableCell } from "@zoonk/ui/components/table";

const columns: AdminTableColumn[] = [
  { label: "Wrong answer", size: "text" },
  { fill: true, label: "What we tell the learner" },
  { label: "Language" },
  { label: "Written" },
];

export async function ItemExplanations({ itemId }: { itemId: string }) {
  "use cache: private";

  const item = await getItem(itemId);
  const explanations = item?.answerExplanations ?? [];

  return (
    <AdminSection title="Wrong answers explained">
      <AdminTableColumns
        columns={columns}
        emptyLabel="No wrong answer has been explained yet."
        isEmpty={explanations.length === 0}
      >
        {explanations.map((explanation) => (
          <AdminTableRow key={explanation.id}>
            <TableCell className="text-foreground whitespace-normal">
              {explanation.normalizedAnswer}
            </TableCell>
            <TableCell className="whitespace-normal">{explanation.explanation}</TableCell>
            <TableCell>{languageName(explanation.language)}</TableCell>
            <TableCell>{formatDate(explanation.createdAt)}</TableCell>
          </AdminTableRow>
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}
