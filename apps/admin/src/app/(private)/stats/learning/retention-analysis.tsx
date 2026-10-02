import { type SignupRetentionRow, getSignupRetention } from "@/data/stats/get-signup-retention";
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
import { toPercent } from "../_utils/metric-trend";
import { type StatsPeriod } from "../_utils/stats-period";

/** Signup weeks are UTC dates, so they're shown in UTC to name the same Monday everywhere. */
const weekFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/** D1, D7 and D30 retention of each signup week that falls in the selected period. */
export async function RetentionAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const rows = await getSignupRetention(statsPeriod.current.start, statsPeriod.current.end);

  return (
    <AdminAnalysisTable description="Learners who signed up each week and were active exactly 1, 7 and 30 days later (any finished activity or study time). A day counts only once it has passed, so young cohorts show a dash instead of a false zero.">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Signup week</TableHead>
            <TableHead className="text-right">Signups</TableHead>
            <TableHead className="text-right">Day 1</TableHead>
            <TableHead className="text-right">Day 7</TableHead>
            <TableHead className="text-right">Day 30</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => <RetentionRow key={row.signupWeek.toISOString()} row={row} />)
          ) : (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                No signups in this period.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </AdminAnalysisTable>
  );
}

function RetentionRow({ row }: { row: SignupRetentionRow }) {
  return (
    <TableRow>
      <TableCell className="font-medium">Week of {weekFormat.format(row.signupWeek)}</TableCell>
      <TableCell className="text-right tabular-nums">{row.signups.toLocaleString()}</TableCell>
      <RetentionCell eligible={row.d1Eligible} retained={row.d1Retained} />
      <RetentionCell eligible={row.d7Eligible} retained={row.d7Retained} />
      <RetentionCell eligible={row.d30Eligible} retained={row.d30Retained} />
    </TableRow>
  );
}

/** Shows the counts behind each rate, since weekly cohorts are often small. */
function RetentionCell({ eligible, retained }: { eligible: number; retained: number }) {
  return (
    <TableCell className="text-right tabular-nums">
      {formatPercent(toPercent({ denominator: eligible, numerator: retained }))}
      {eligible > 0 ? (
        <span className="text-muted-foreground ml-2 text-xs">
          {retained}/{eligible}
        </span>
      ) : null}
    </TableCell>
  );
}
