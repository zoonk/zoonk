import { AdminTableRow } from "@/components/admin-table-row";
import { countLearnerSkillsByState, getMasteryTrend } from "@/data/stats/get-mastery-trend";
import { formatPercent } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader } from "@zoonk/ui/components/table";
import { AdminAnalysisTrend } from "../_components/admin-analysis-trend";
import { AdminMetricTrendChart } from "../_components/admin-metric-trend-chart";
import { buildMetricTrend, sumRows, toPercent } from "../_utils/metric-trend";
import { type StatsPeriod } from "../_utils/stats-period";

const STATE_LABELS = {
  learning: "Learning",
  mastered: "Mastered",
  new: "New",
  solid: "Solid",
} as const;

export async function MasteryAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentRows, previousRows, states] = await Promise.all([
    getMasteryTrend(current.start, current.end, chartPeriod),
    getMasteryTrend(previous.start, previous.end, chartPeriod),
    countLearnerSkillsByState(),
  ]);

  const solid = sumRows({ rows: currentRows, value: (row) => row.solid });
  const mastered = sumRows({ rows: currentRows, value: (row) => row.mastered });

  const dataPoints = buildMetricTrend({
    emptyValue: 0,
    points: currentRows.map((row) => ({ count: row.solid + row.mastered, date: row.date })),
    statsPeriod,
  });

  return (
    <AdminAnalysisTrend
      comparison={{
        comparisonLabel,
        current: solid + mastered,
        previous: sumRows({ rows: previousRows, value: (row) => row.solid + row.mastered }),
      }}
      description={`Learner skills now solid (${solid.toLocaleString()}) or mastered (${mastered.toLocaleString()}), by the date of the review that last confirmed them. A skill keeps only its current state; when it first reached one comes from PostHog (Skill Level Changed).`}
      value={(solid + mastered).toLocaleString()}
    >
      <AdminMetricTrendChart dataPoints={dataPoints} label="Mastery growth" valueFormat="number" />
      <MasteryStateTable states={states} />
    </AdminAnalysisTrend>
  );
}

function MasteryStateTable({
  states,
}: {
  states: Awaited<ReturnType<typeof countLearnerSkillsByState>>;
}) {
  const total = sumRows({ rows: states, value: (row) => row.count });

  return (
    <Table>
      <TableHeader>
        <AdminTableRow>
          <TableHead>Current state (all time)</TableHead>
          <TableHead numeric>Learner skills</TableHead>
          <TableHead numeric>Share</TableHead>
        </AdminTableRow>
      </TableHeader>

      <TableBody>
        {states.length > 0 ? (
          states.map((row) => (
            <AdminTableRow key={row.state}>
              <TableCell className="font-medium">{STATE_LABELS[row.state]}</TableCell>
              <TableCell numeric>{row.count.toLocaleString()}</TableCell>
              <TableCell numeric>
                {formatPercent(toPercent({ denominator: total, numerator: row.count }))}
              </TableCell>
            </AdminTableRow>
          ))
        ) : (
          <AdminTableRow>
            <TableCell className="text-muted-foreground" colSpan={3}>
              No learner skills yet.
            </TableCell>
          </AdminTableRow>
        )}
      </TableBody>
    </Table>
  );
}
