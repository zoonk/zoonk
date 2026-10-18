import {
  type CheckpointOutcomeRow,
  getCheckpointOutcomeTrend,
} from "@/data/stats/get-checkpoint-outcome-trend";
import { getExamResults } from "@/data/stats/get-exam-results";
import { countGoalsByStatus, getGoalsReachedTrend } from "@/data/stats/get-goals-reached-trend";
import { formatPercent } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { AdminAnalysisTable } from "../_components/admin-analysis-table";
import { AdminAnalysisTrend } from "../_components/admin-analysis-trend";
import { AdminMetricTrendChart } from "../_components/admin-metric-trend-chart";
import { buildMetricTrend, sumRows, toPercent, toRatePoints } from "../_utils/metric-trend";
import { type OutcomesAnalysisView } from "../_utils/stats-analysis";
import { type StatsPeriod } from "../_utils/stats-period";

/** Loads one Outcomes question at a time. */
export async function OutcomeMetrics({
  statsPeriod,
  view,
}: {
  statsPeriod: StatsPeriod;
  view: OutcomesAnalysisView;
}) {
  "use cache: private";

  if (view.id === "mock-exams") {
    return <MockExamAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "checkpoints-passed") {
    return <CheckpointAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "exam-results") {
    return <ExamResultsAnalysis statsPeriod={statsPeriod} />;
  }

  return <GoalsReachedAnalysis statsPeriod={statsPeriod} />;
}

async function GoalsReachedAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentRows, previousRows, statuses] = await Promise.all([
    getGoalsReachedTrend(current.start, current.end, chartPeriod),
    getGoalsReachedTrend(previous.start, previous.end, chartPeriod),
    countGoalsByStatus(),
  ]);

  const reached = sumRows({ rows: currentRows, value: (row) => row.count });
  const allGoals = sumRows({ rows: statuses, value: (row) => row.count });
  const completed = statuses.find((row) => row.status === "completed")?.count ?? 0;

  return (
    <AdminAnalysisTrend
      comparison={{
        comparisonLabel,
        current: reached,
        previous: sumRows({ rows: previousRows, value: (row) => row.count }),
      }}
      description={`Goals marked completed, dated by their last update since goals store no completion date. ${completed.toLocaleString()} of ${allGoals.toLocaleString()} goals are completed overall.`}
      value={reached.toLocaleString()}
    >
      <AdminMetricTrendChart
        dataPoints={buildMetricTrend({
          emptyValue: 0,
          points: currentRows.map((row) => ({ count: row.count, date: row.date })),
          statsPeriod,
        })}
        label="Goals reached"
        valueFormat="number"
      />
    </AdminAnalysisTrend>
  );
}

function getScore(rows: readonly CheckpointOutcomeRow[]): number | null {
  return toPercent({
    denominator: sumRows({ rows, value: (row) => row.answers }),
    numerator: sumRows({ rows, value: (row) => row.correct }),
  });
}

/** An exam's weekly Big Challenge, scored as correct answers over all its questions. */
async function MockExamAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentRows, previousRows] = await Promise.all([
    getCheckpointOutcomeTrend("mock", current.start, current.end, chartPeriod),
    getCheckpointOutcomeTrend("mock", previous.start, previous.end, chartPeriod),
  ]);

  const score = getScore(currentRows);
  const finished = sumRows({ rows: currentRows, value: (row) => row.finished });

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: score ?? 0, previous: getScore(previousRows) ?? 0 }}
      description={`Average score of ${finished.toLocaleString()} mock exams (an exam goal's weekly Big Challenge) finished in the selected period.`}
      value={formatPercent(score)}
    >
      <AdminMetricTrendChart
        dataPoints={buildMetricTrend({
          emptyValue: null,
          points: toRatePoints({
            denominator: (row) => row.answers,
            numerator: (row) => row.correct,
            rows: currentRows,
          }),
          statsPeriod,
        })}
        label="Mock exam score"
        valueFormat="percent"
      />
    </AdminAnalysisTrend>
  );
}

/** Bosses and weekly challenges that reached the pass mark of seven in ten. */
async function CheckpointAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentRows, previousRows] = await Promise.all([
    getCheckpointOutcomeTrend("checkpoint", current.start, current.end, chartPeriod),
    getCheckpointOutcomeTrend("checkpoint", previous.start, previous.end, chartPeriod),
  ]);

  const passed = sumRows({ rows: currentRows, value: (row) => row.passed });
  const finished = sumRows({ rows: currentRows, value: (row) => row.finished });
  const passRate = formatPercent(toPercent({ denominator: finished, numerator: passed }));

  return (
    <AdminAnalysisTrend
      comparison={{
        comparisonLabel,
        current: passed,
        previous: sumRows({ rows: previousRows, value: (row) => row.passed }),
      }}
      description={`${passed.toLocaleString()} of ${finished.toLocaleString()} checkpoints (bosses and non-exam weekly challenges) reached the pass mark of seven in ten (${passRate}).`}
      value={passed.toLocaleString()}
    >
      <AdminMetricTrendChart
        dataPoints={buildMetricTrend({
          emptyValue: 0,
          points: currentRows.map((row) => ({ count: row.passed, date: row.date })),
          statsPeriod,
        })}
        label="Checkpoints passed"
        valueFormat="number"
      />
    </AdminAnalysisTrend>
  );
}

const DECIMALS = 1;

/**
 * Official results learners report after their exam ("How did it go?"), by exam: passes, how
 * often the official score landed inside the estimate shown before, and the mocks behind it.
 */
async function ExamResultsAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const rows = await getExamResults(statsPeriod.current.start, statsPeriod.current.end);

  return (
    <AdminAnalysisTable description="Official results learners reported in the period, by exam. Inside estimate counts reports whose score landed in the range shown before the exam, on the same scale; the error is the official score minus the middle of that range. Estimates are calibrated per exam once five reports have both.">
      {rows.length === 0 ? (
        <p className="text-muted-foreground p-6 text-sm">No results reported in this period.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead className="text-right">Reports</TableHead>
              <TableHead className="text-right">Passed</TableHead>
              <TableHead className="text-right">Inside estimate</TableHead>
              <TableHead className="text-right">Avg. error</TableHead>
              <TableHead className="text-right">Avg. mocks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.examName}>
                <TableCell className="font-medium">{row.examName}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.reports.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.passed.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.withEstimate > 0
                    ? formatPercent(
                        toPercent({ denominator: row.withEstimate, numerator: row.withinEstimate }),
                      )
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.avgEstimateError === null ? "—" : row.avgEstimateError.toFixed(DECIMALS)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.avgMocks.toFixed(DECIMALS)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AdminAnalysisTable>
  );
}
