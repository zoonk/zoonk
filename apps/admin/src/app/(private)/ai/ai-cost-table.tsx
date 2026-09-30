import { type AiGenerationCostRow } from "@/data/ai/get-ai-generation-costs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { sumOf } from "@zoonk/utils/number";
import { formatLatency, formatUsd } from "./_utils/ai-format";

function AiCostRow({ row }: { row: AiGenerationCostRow }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{row.task}</TableCell>
      <TableCell className="font-mono text-xs">{row.model}</TableCell>
      <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatUsd(row.totalCostUsd)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsd(row.calls > 0 ? row.totalCostUsd / row.calls : 0)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatLatency(row.p50LatencySeconds)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatLatency(row.p95LatencySeconds)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsd(row.totalCostUsd - row.personalCostUsd)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatUsd(row.personalCostUsd)}</TableCell>
    </TableRow>
  );
}

/** Totals across every task, so the shared and personal split reads at a glance. */
function AiCostTotals({ rows }: { rows: AiGenerationCostRow[] }) {
  const calls = sumOf(rows.map((row) => row.calls));
  const totalCost = sumOf(rows.map((row) => row.totalCostUsd));
  const personalCost = sumOf(rows.map((row) => row.personalCostUsd));

  return (
    <TableFooter>
      <TableRow>
        <TableCell colSpan={2}>All tasks</TableCell>
        <TableCell className="text-right tabular-nums">{calls.toLocaleString()}</TableCell>
        <TableCell className="text-right tabular-nums">{formatUsd(totalCost)}</TableCell>
        <TableCell className="text-right tabular-nums">
          {formatUsd(calls > 0 ? totalCost / calls : 0)}
        </TableCell>
        <TableCell colSpan={2} />
        <TableCell className="text-right tabular-nums">
          {formatUsd(totalCost - personalCost)}
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatUsd(personalCost)}</TableCell>
      </TableRow>
    </TableFooter>
  );
}

/**
 * Shared content is written once and reused by every learner; personal content is written for one
 * learner. The split shows how much of the bill each kind drives.
 */
export function AiCostTable({ rows }: { rows: AiGenerationCostRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Per call</TableHead>
            <TableHead className="text-right">p50</TableHead>
            <TableHead className="text-right">p95</TableHead>
            <TableHead className="text-right">Shared</TableHead>
            <TableHead className="text-right">Personal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <AiCostRow key={`${row.task}|${row.model}`} row={row} />
          ))}
        </TableBody>
        <AiCostTotals rows={rows} />
      </Table>
    </div>
  );
}
