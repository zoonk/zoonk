import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { type DownvoteRateGroup } from "@/data/feedback/list-downvote-rates";
import { formatPercent } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import { feedbackContentKindLabels, feedbackReasonLabels } from "../_utils/feedback-labels";

const columns: AdminTableColumn[] = [
  { label: "Model" },
  { label: "Prompt version" },
  { label: "Content" },
  { align: "right", label: "Votes" },
  { align: "right", label: "Downvotes" },
  { align: "right", label: "Rate" },
  { label: "Top reasons" },
];

function toGroupKey(group: DownvoteRateGroup): string {
  return [group.model, group.promptVersion, group.contentKind].join("|");
}

function formatTopReasons(group: DownvoteRateGroup): string {
  if (group.topReasons.length === 0) {
    return "—";
  }

  return group.topReasons
    .map(({ count, reason }) => `${feedbackReasonLabels[reason]} (${count})`)
    .join(", ");
}

function DownvoteRateRow({ group }: { group: DownvoteRateGroup }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{group.model ?? "Unknown"}</TableCell>
      <TableCell className="font-mono text-xs">{group.promptVersion ?? "Unknown"}</TableCell>
      <TableCell>{feedbackContentKindLabels[group.contentKind]}</TableCell>
      <TableCell className="text-right tabular-nums">{group.votes.toLocaleString()}</TableCell>
      <TableCell className="text-right tabular-nums">{group.downvotes.toLocaleString()}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatPercent(group.rate)}
      </TableCell>
      <TableCell className="max-w-72 min-w-48 text-xs whitespace-normal">
        {formatTopReasons(group)}
      </TableCell>
    </TableRow>
  );
}

/** Rates per model, prompt version and content kind, in the order the caller ranked them. */
export function DownvoteRateTable({ groups }: { groups: DownvoteRateGroup[] }) {
  return (
    <AdminTableColumns columns={columns} emptyLabel="No votes." isEmpty={groups.length === 0}>
      {groups.map((group) => (
        <DownvoteRateRow group={group} key={toGroupKey(group)} />
      ))}
    </AdminTableColumns>
  );
}
