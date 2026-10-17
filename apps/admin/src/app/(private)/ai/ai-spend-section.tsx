import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { Stats } from "@/components/stats";
import { getAiSpendSummary } from "@/data/ai/get-ai-spend-summary";
import { listAiSpendByModel } from "@/data/ai/list-ai-spend-by-model";
import { listAiSpendByTask } from "@/data/ai/list-ai-spend-by-task";
import { listDailyAiSpend } from "@/data/ai/list-daily-ai-spend";
import { formatLatency, formatShare, formatTokens, formatUsd } from "@/lib/ai-format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import { AiDailySpendChart } from "./ai-daily-spend-chart";

const taskColumns: AdminTableColumn[] = [
  { label: "Task" },
  { align: "right", label: "Calls" },
  { align: "right", label: "Cost" },
  { align: "right", label: "Per call" },
  { align: "right", label: "Personal" },
  { align: "right", label: "Cached input" },
  { align: "right", label: "Flex calls" },
  { align: "right", label: "p50" },
];

const modelColumns: AdminTableColumn[] = [
  { label: "Model" },
  { label: "Tier" },
  { align: "right", label: "Calls" },
  { align: "right", label: "Input" },
  { align: "right", label: "Cached" },
  { align: "right", label: "Output" },
  { align: "right", label: "Cost" },
  { align: "right", label: "Gateway estimate" },
];

const MS_PER_SECOND = 1000;

async function SpendSummary({ days }: { days: number }) {
  const summary = await getAiSpendSummary(days);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Stats
        description={`${summary.calls.toLocaleString()} calls`}
        title="Spend"
        value={formatUsd(summary.costUsd)}
      />
      <Stats
        help="AI Gateway's own list-price estimate; a gap means our price list needs refreshing."
        title="Gateway estimate"
        value={formatUsd(summary.gatewayCostUsd)}
      />
      <Stats
        description={`${formatTokens(summary.cacheReadTokens)} of ${formatTokens(summary.inputTokens)} input tokens`}
        title="Read from cache"
        value={formatShare({ part: summary.cacheReadTokens, whole: summary.inputTokens })}
      />
      <Stats
        help="Calls whose model has no price in @zoonk/ai's price list. Run pnpm --filter @zoonk/ai prices:refresh."
        title="Unpriced calls"
        value={summary.unpricedCalls.toLocaleString()}
      />
    </div>
  );
}

async function DailySpend({ days }: { days: number }) {
  const daily = await listDailyAiSpend(days);

  const points = daily.map((row) => ({
    costUsd: row.costUsd,
    label: row.day.toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" }),
  }));

  return <AiDailySpendChart points={points} />;
}

async function SpendByTask({ days }: { days: number }) {
  const rows = await listAiSpendByTask(days);

  return (
    <AdminTableColumns columns={taskColumns} emptyLabel="No AI calls." isEmpty={rows.length === 0}>
      {rows.map((row) => (
        <TableRow key={row.task}>
          <TableCell className="font-mono text-xs">{row.task}</TableCell>
          <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">
            {formatUsd(row.costUsd)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatUsd(row.calls > 0 ? row.costUsd / row.calls : 0)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatUsd(row.personalCostUsd)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatShare({ part: row.cacheReadTokens, whole: row.inputTokens })}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {row.flexCalls.toLocaleString()}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatLatency(row.p50LatencyMs === null ? null : row.p50LatencyMs / MS_PER_SECOND)}
          </TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}

async function SpendByModel({ days }: { days: number }) {
  const rows = await listAiSpendByModel(days);

  return (
    <AdminTableColumns columns={modelColumns} emptyLabel="No AI calls." isEmpty={rows.length === 0}>
      {rows.map((row) => (
        <TableRow key={`${row.model}|${row.serviceTier ?? "standard"}`}>
          <TableCell className="font-mono text-xs">{row.model}</TableCell>
          <TableCell className="text-xs">{row.serviceTier ?? "standard"}</TableCell>
          <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
          <TableCell className="text-right tabular-nums">{formatTokens(row.inputTokens)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatShare({ part: row.cacheReadTokens, whole: row.inputTokens })}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatTokens(row.outputTokens)}
          </TableCell>
          <TableCell className="text-right font-medium tabular-nums">
            {formatUsd(row.costUsd)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {row.gatewayCostUsd === null ? "—" : formatUsd(row.gatewayCostUsd)}
          </TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}

/**
 * What every AI call cost, from the database's AI call log: priced from each call's tokens and
 * our dated price list, since with our own provider keys the gateway bills nothing.
 */
export async function AiSpendSection({ days }: { days: number }) {
  return (
    <>
      <AdminSection description={`Every AI call in the last ${days} days.`} title="Spend">
        <div className="flex flex-col gap-6">
          <SpendSummary days={days} />
          <DailySpend days={days} />
        </div>
      </AdminSection>

      <AdminSection description="Most expensive first." title="Spend by task">
        <SpendByTask days={days} />
      </AdminSection>

      <AdminSection
        description="Per model and the tier that served it, with our cost beside the gateway's estimate."
        title="Spend by model"
      >
        <SpendByModel days={days} />
      </AdminSection>
    </>
  );
}
