import { type ModeMetricComparison, type ModeMetricKey } from "@/data/stats/_utils/mode-matching";
import { getModeComparison } from "@/data/stats/get-mode-comparison";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { AdminAnalysisTable } from "../_components/admin-analysis-table";
import { type StatsPeriod } from "../_utils/stats-period";

type MetricFormat = "number" | "percent";

const METRIC_ROWS = {
  activeDaysPerWeek: { format: "number", label: "Active days per week" },
  d1Retention: { format: "percent", label: "Retention on day 1" },
  d30Retention: { format: "percent", label: "Retention on day 30" },
  d7Retention: { format: "percent", label: "Retention on day 7" },
  dailyMinutes: { format: "number", label: "Minutes per study day" },
  masteredPerHour: { format: "number", label: "Skills mastered per study hour" },
  plusConversion: { format: "percent", label: "Plus conversion (active paid plan)" },
  sessionCompletion: { format: "percent", label: "Sessions finished" },
  spacedAccuracy: { format: "percent", label: "Accuracy after 7+ days away (guardrail)" },
} as const satisfies Record<ModeMetricKey, { format: MetricFormat; label: string }>;

function formatValue({ format, value }: { format: MetricFormat; value: number | null }): string {
  if (value === null) {
    return "—";
  }

  return format === "percent"
    ? `${value.toFixed(1)}%`
    : value.toLocaleString("en", { maximumFractionDigits: 2 });
}

/** Fun minus Focus, in percentage points for rates. */
function formatDifference({
  format,
  metric,
}: {
  format: MetricFormat;
  metric: ModeMetricComparison;
}) {
  if (metric.focus === null || metric.fun === null) {
    return "—";
  }

  const difference = metric.fun - metric.focus;

  const formatted = difference.toLocaleString("en", {
    maximumFractionDigits: format === "percent" ? 1 : 2,
    signDisplay: "exceptZero",
  });

  return format === "percent" ? `${formatted} pp` : formatted;
}

/**
 * People who pick Fun differ from people who don't, so the comparison matches them exactly and
 * shows how many Fun learners each metric rests on.
 */
export async function ModeComparisonAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  "use cache: private";

  const comparison = await getModeComparison(statsPeriod.current.start, statsPeriod.current.end);

  return (
    <AdminAnalysisTable
      description={`Learners who signed up in the selected period and went through onboarding, matched exactly on goal kind, age band, locale (the goal's language) and signup week. Only strata with both modes count, each weighted by its Fun learners, so Focus is reweighted to look like the Fun group. ${comparison.unmatchedLearners.toLocaleString()} learners without a match are left out. Platform isn't stored in the database, so it isn't matched; mode switches and reviews done on time come from PostHog.`}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead className="text-right">Focus</TableHead>
            <TableHead className="text-right">Fun</TableHead>
            <TableHead className="text-right">Fun − Focus</TableHead>
            <TableHead className="text-right">Fun learners counted</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Learners compared</TableCell>
            <TableCell className="text-right tabular-nums">
              {comparison.focusLearners.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {comparison.funLearners.toLocaleString()}
            </TableCell>
            <TableCell className="text-muted-foreground text-right">—</TableCell>
            <TableCell className="text-muted-foreground text-right tabular-nums">
              {comparison.matchedStrata.toLocaleString()} strata
            </TableCell>
          </TableRow>

          {comparison.metrics.map((metric) => (
            <ModeMetricRow key={metric.key} metric={metric} />
          ))}
        </TableBody>
      </Table>
    </AdminAnalysisTable>
  );
}

function ModeMetricRow({ metric }: { metric: ModeMetricComparison }) {
  const { format, label } = METRIC_ROWS[metric.key];

  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatValue({ format, value: metric.focus })}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatValue({ format, value: metric.fun })}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatDifference({ format, metric })}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {metric.funLearners.toLocaleString()}
      </TableCell>
    </TableRow>
  );
}
