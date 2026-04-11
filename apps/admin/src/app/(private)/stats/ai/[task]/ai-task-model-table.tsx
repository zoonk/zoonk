import { type AiTaskModelReport } from "@/data/stats/ai/get-ai-task-report";
import { Badge } from "@zoonk/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { formatAiCost } from "../format-ai-cost";

/**
 * The task detail view is centered on model-level breakdowns. A simple table
 * keeps the requested metrics aligned so model comparisons are easy to scan.
 */
export function AiTaskModelTable({ models }: { models: AiTaskModelReport[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Model</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Requests</TableHead>
          <TableHead className="text-right">Total Cost</TableHead>
          <TableHead className="text-right">Market Cost</TableHead>
          <TableHead className="text-right">Avg Market Cost / Request</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {models.map((model) => (
          <AiTaskModelRow key={model.model} model={model} />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Each row reflects one aggregated gateway report entry, so the component stays
 * dumb and only formats numbers for scanning in the admin UI.
 */
function AiTaskModelRow({ model }: { model: AiTaskModelReport }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{model.model}</TableCell>
      <TableCell>
        <Badge variant={model.isFallback ? "secondary" : "outline"}>
          {model.isFallback ? "Fallback" : "Default"}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {model.requestCount.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatAiCost(model.totalCost)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatAiCost(model.marketCost)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatAiCost(model.averageMarketCostPerRequest)}
      </TableCell>
    </TableRow>
  );
}
