import { ProvenanceLine } from "@/components/provenance";
import { VoteTotalsLabel } from "@/components/vote-totals";
import { type VoteTotals } from "@/data/feedback/get-vote-totals";
import { type ItemAnswerStats, getItemAccuracy } from "@/data/items/get-item-answer-stats";
import { type ListedItem } from "@/data/items/list-items";
import { formatDate, formatPercent } from "@/lib/format";
import { ITEM_FORMAT_LABELS, getItemLabel } from "@/lib/item-label";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

export function ItemRow({
  answerStats,
  item,
  votes,
}: {
  answerStats: ItemAnswerStats;
  item: ListedItem;
  votes: VoteTotals;
}) {
  return (
    <TableRow>
      <TableCell className="max-w-80 min-w-64 whitespace-normal">
        <Link
          className="line-clamp-2 font-medium hover:underline"
          href={`/items/${item.id}`}
          prefetch
        >
          {getItemLabel(item)}
        </Link>
      </TableCell>
      <TableCell className="max-w-56 min-w-40 whitespace-normal">
        <Link
          className="line-clamp-2 hover:underline"
          href={`/skills/${item.skill.id}`}
          prefetch={false}
        >
          {item.skill.name}
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
        <VoteTotalsLabel totals={votes} />
      </TableCell>
      <TableCell>
        <ProvenanceLine provenance={item} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
    </TableRow>
  );
}
