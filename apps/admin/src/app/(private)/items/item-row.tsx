import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminTableRow } from "@/components/admin-table-row";
import { type ItemAnswerStats, getItemAccuracy } from "@/data/items/get-item-answer-stats";
import { type ListedItem } from "@/data/items/list-items";
import { formatPercent } from "@/lib/format";
import { ITEM_FORMAT_LABELS, getItemLabel } from "@/lib/item-label";
import { languageName } from "@/lib/language-filter";
import { TableCell } from "@zoonk/ui/components/table";

export function ItemRow({ answerStats, item }: { answerStats: ItemAnswerStats; item: ListedItem }) {
  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/items/${item.id}`}
        note={[languageName(item.language), item.examBlueprint?.name].filter(Boolean).join(" · ")}
        title={getItemLabel(item)}
      />
      <TableCell className="whitespace-normal">
        <span className="line-clamp-2">{item.skill.name}</span>
      </TableCell>
      <TableCell>{ITEM_FORMAT_LABELS[item.format]}</TableCell>
      <TableCell numeric>{answerStats.attempts.toLocaleString("en")}</TableCell>
      {answerStats.attempts > 0 ? (
        <TableCell numeric>{formatPercent(getItemAccuracy(answerStats))}</TableCell>
      ) : (
        <TableCell className="text-right">No answers yet</TableCell>
      )}
    </AdminTableRow>
  );
}
