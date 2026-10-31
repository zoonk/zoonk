import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { ProvenanceLine } from "@/components/provenance";
import { type ItemAnswerStats, getItemAccuracy } from "@/data/items/get-item-answer-stats";
import { type ListedItem } from "@/data/items/list-items";
import { formatDate, formatPercent } from "@/lib/format";
import { ITEM_FORMAT_LABELS, getItemLabel } from "@/lib/item-label";
import { TableCell } from "@zoonk/ui/components/table";
import Link from "next/link";

export function ItemRow({ answerStats, item }: { answerStats: ItemAnswerStats; item: ListedItem }) {
  return (
    <AdminTableRow>
      <TableCell className="max-w-80 min-w-64 whitespace-normal">
        <AdminTableRowLink className="font-medium" href={`/items/${item.id}`} prefetch>
          <span className="line-clamp-2">{getItemLabel(item)}</span>
        </AdminTableRowLink>
      </TableCell>
      <TableCell className="max-w-56 min-w-40 whitespace-normal">
        <Link className="hover:underline" href={`/skills/${item.skill.id}`} prefetch={false}>
          <span className="line-clamp-2">{item.skill.name}</span>
        </Link>
      </TableCell>
      <TableCell>{ITEM_FORMAT_LABELS[item.format]}</TableCell>
      <TableCell className="uppercase">{item.language}</TableCell>
      <TableCell>{item.field ?? "—"}</TableCell>
      <TableCell>
        {item.examBlueprint ? (
          <Link
            className="hover:underline"
            href={`/exams/${item.examBlueprint.id}`}
            prefetch={false}
          >
            {item.examBlueprint.name}
          </Link>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{answerStats.attempts}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatPercent(getItemAccuracy(answerStats))}
      </TableCell>
      <TableCell>
        <ProvenanceLine provenance={item} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
    </AdminTableRow>
  );
}
