import { AdminBarChart } from "@/components/admin-bar-chart";
import { AdminToolbar } from "@/components/admin-page";
import { AdminSection, AdminSectionMore } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { AdminTabs } from "@/components/admin-tabs";
import { AdminUserCell } from "@/components/admin-user-cell";
import { AiTaskName } from "@/components/ai-task-name";
import { GoalKindIcon } from "@/components/goal-kind-icon";
import { STAT_TILES_CLASS, StatTile } from "@/components/stat-tile";
import { getAiSpendSummary } from "@/data/ai/get-ai-spend-summary";
import { listAiSpendByModel } from "@/data/ai/list-ai-spend-by-model";
import { listAiSpendByTask } from "@/data/ai/list-ai-spend-by-task";
import { listDailyAiSpend } from "@/data/ai/list-daily-ai-spend";
import { listTopAiSpendingGoals, listTopAiSpendingLearners } from "@/data/ai/list-top-ai-spenders";
import { buildAdminHref } from "@/lib/admin-href";
import {
  formatDollars,
  formatLatency,
  formatShare,
  formatTokens,
  formatUsd,
} from "@/lib/ai-format";
import { formatCount, toWords } from "@/lib/format";
import { readEnumQueryParam } from "@/lib/query-param";
import { TableCell } from "@zoonk/ui/components/table";
import { CpuIcon, DatabaseZapIcon, HashIcon, ReceiptIcon } from "lucide-react";
import { aiPeriodDays } from "./_utils/ai-period";

const SPEND_BY = ["task", "model", "goal", "learner"] as const;

type SpendBy = (typeof SPEND_BY)[number];

export function parseSpendBy(value: string | string[] | undefined): SpendBy {
  return readEnumQueryParam({ allowed: SPEND_BY, value }) ?? "task";
}

/** A ranking opens on its first rows: the most expensive few are what the page is asked for. */
const TOP_ROWS = 8;
const MS_PER_SECOND = 1000;

const DAY_LABEL = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

type View = { by: SpendBy; days: number; showAll: boolean };

function spendHref({ by, days, showAll }: View) {
  return buildAdminHref({
    params: {
      all: showAll ? "1" : undefined,
      by: by === "task" ? undefined : by,
      days: String(days),
    },
    path: "/ai",
  });
}

async function SpendTiles({ days }: { days: number }) {
  const summary = await getAiSpendSummary(days);

  return (
    <div className={STAT_TILES_CLASS}>
      <StatTile
        detail={`AI Gateway estimates ${formatDollars(summary.gatewayCostUsd)}`}
        help="What our own provider keys paid, from our dated price list, plus what the gateway charged, such as its search fees. A gap from the gateway's estimate means the price list needs refreshing."
        icon={<CpuIcon />}
        title="Spend"
        value={formatDollars(summary.costUsd)}
      />
      <StatTile
        detail={
          summary.unpricedCalls > 0
            ? `${summary.unpricedCalls.toLocaleString("en")} without a price`
            : undefined
        }
        help="A call without a price used a model missing from @zoonk/ai's price list. Run pnpm --filter @zoonk/ai prices:refresh."
        icon={<HashIcon />}
        title="Calls"
        value={summary.calls.toLocaleString("en")}
      />
      <StatTile
        icon={<ReceiptIcon />}
        title="Cost per call"
        value={formatUsd(summary.calls > 0 ? summary.costUsd / summary.calls : 0)}
      />
      <StatTile
        detail={`${formatTokens(summary.cacheReadTokens)} of ${formatTokens(summary.inputTokens)} input tokens`}
        icon={<DatabaseZapIcon />}
        title="Read from cache"
        value={formatShare({ part: summary.cacheReadTokens, whole: summary.inputTokens })}
      />
    </div>
  );
}

async function DailySpend({ days }: { days: number }) {
  const daily = await listDailyAiSpend(days);

  return (
    <AdminSection title="Spend a day">
      <AdminBarChart
        className="h-52 w-full"
        format="usd"
        label={`AI spend a day, the last ${days} days`}
        points={daily.map((row) => ({ label: DAY_LABEL.format(row.day), value: row.costUsd }))}
      />
    </AdminSection>
  );
}

const taskColumns: AdminTableColumn[] = [
  { label: "Task", twoLines: true },
  { align: "right", label: "Calls" },
  { align: "right", label: "Cost" },
  { align: "right", label: "Per call" },
  { align: "right", label: "Typical time" },
];

const modelColumns: AdminTableColumn[] = [
  { label: "Model", twoLines: true },
  { align: "right", label: "Calls" },
  { align: "right", label: "Input" },
  { align: "right", label: "Output" },
  { align: "right", label: "Cost" },
];

const goalColumns: AdminTableColumn[] = [
  { label: "Goal" },
  { label: "Learner", size: "text" },
  { align: "right", label: "Calls" },
  { align: "right", label: "Cost" },
];

const learnerColumns: AdminTableColumn[] = [
  { label: "Learner", twoLines: true },
  { align: "right", label: "Calls" },
  { align: "right", label: "Cost" },
];

function Cost({ value }: { value: number }) {
  return (
    <TableCell className="text-foreground font-medium" numeric>
      {formatUsd(value)}
    </TableCell>
  );
}

async function loadRanking({ by, days }: Pick<View, "by" | "days">) {
  if (by === "task") {
    const rows = await listAiSpendByTask(days);

    return {
      columns: taskColumns,
      noun: "task",
      rows: rows.map((row) => (
        <AdminTableRow key={row.task}>
          <TableCell>
            <AiTaskName task={row.task} />
          </TableCell>
          <TableCell numeric>{row.calls.toLocaleString("en")}</TableCell>
          <Cost value={row.costUsd} />
          <TableCell numeric>{formatUsd(row.calls > 0 ? row.costUsd / row.calls : 0)}</TableCell>
          <TableCell numeric>
            {formatLatency(row.p50LatencyMs === null ? null : row.p50LatencyMs / MS_PER_SECOND)}
          </TableCell>
        </AdminTableRow>
      )),
    };
  }

  if (by === "model") {
    const rows = await listAiSpendByModel(days);

    return {
      columns: modelColumns,
      noun: "model",
      rows: rows.map((row) => (
        <AdminTableRow key={`${row.model}|${row.serviceTier ?? "standard"}`}>
          <TableCell>
            <span className="text-foreground block truncate font-medium">{row.model}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {toWords(row.serviceTier ?? "standard")}
            </span>
          </TableCell>
          <TableCell numeric>{row.calls.toLocaleString("en")}</TableCell>
          <TableCell numeric>{formatTokens(row.inputTokens)}</TableCell>
          <TableCell numeric>{formatTokens(row.outputTokens)}</TableCell>
          <Cost value={row.costUsd} />
        </AdminTableRow>
      )),
    };
  }

  if (by === "goal") {
    const goals = await listTopAiSpendingGoals(days);

    return {
      columns: goalColumns,
      noun: "goal",
      rows: goals.map((row) => (
        <AdminTableRow key={row.id}>
          <TableCell className="text-foreground font-medium">
            {row.goal ? (
              <>
                <GoalKindIcon
                  className="me-1.5 inline-block align-[-0.15em]"
                  kind={row.goal.kind}
                />
                {row.goal.title}
              </>
            ) : (
              "Deleted goal"
            )}
          </TableCell>
          <TableCell>
            {row.goal ? (
              <AdminTableRowLink href={`/users/${row.goal.user.id}?tab=plan`} prefetch>
                {row.goal.user.email}
              </AdminTableRowLink>
            ) : null}
          </TableCell>
          <TableCell numeric>{row.calls.toLocaleString("en")}</TableCell>
          <Cost value={row.costUsd} />
        </AdminTableRow>
      )),
    };
  }

  const learners = await listTopAiSpendingLearners(days);

  return {
    columns: learnerColumns,
    noun: "learner",
    rows: learners.map((row) => (
      <AdminTableRow key={row.id}>
        <AdminUserCell user={row.user} userId={row.id} />
        <TableCell numeric>{row.calls.toLocaleString("en")}</TableCell>
        <Cost value={row.costUsd} />
      </AdminTableRow>
    )),
  };
}

async function WhereItWent({ by, days, showAll }: View) {
  const { columns, noun, rows } = await loadRanking({ by, days });

  return (
    <AdminSection
      action={
        <AdminTabs
          label="Spend by"
          options={SPEND_BY.map((key) => ({
            href: spendHref({ by: key, days, showAll: false }),
            isActive: key === by,
            label: toWords(key),
          }))}
        />
      }
      title="Where it went"
    >
      <AdminTableColumns columns={columns} emptyLabel="No AI calls." isEmpty={rows.length === 0}>
        {showAll ? rows : rows.slice(0, TOP_ROWS)}
      </AdminTableColumns>
      {!showAll && rows.length > TOP_ROWS ? (
        <AdminSectionMore href={spendHref({ by, days, showAll: true })}>
          Show all {formatCount(rows.length, noun)}
        </AdminSectionMore>
      ) : null}
    </AdminSection>
  );
}

/** What AI cost in a period: the total and its shape, a bar a day, then what it was spent on. */
export function AiSpendSection({ by, days, showAll }: View) {
  return (
    <>
      <AdminToolbar>
        <AdminTabs
          label="Period"
          options={aiPeriodDays.map((period) => ({
            href: spendHref({ by, days: period, showAll: false }),
            isActive: period === days,
            label: `${period} days`,
          }))}
        />
      </AdminToolbar>

      <SpendTiles days={days} />
      <DailySpend days={days} />
      <WhereItWent by={by} days={days} showAll={showAll} />
    </>
  );
}
