"use client";

import { type ActivityExpectedAnswer } from "@zoonk/core/library/activities/expected-answer";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import { type QueryResult } from "../_sandbox/run-query";
import { compareRows } from "./sql-rows";
import { SqlRowsTable } from "./sql-table";

type ExpectedRows = Extract<ActivityExpectedAnswer, { kind: "rows" }>;

/**
 * The rows the last run returned. After the check, rows the expected result doesn't have are
 * marked; a result from before the latest edit is dimmed until the next run.
 */
export function SqlResult({
  expected,
  isStale,
  result,
}: {
  expected: ExpectedRows | null;
  isStale: boolean;
  result: QueryResult;
}) {
  const t = useExtracted();

  const rowStates = expected
    ? compareRows({
        actual: result.rows,
        expected: expected.rows,
        orderMatters: expected.orderMatters,
      }).actualMatched.map((matched) => (matched ? ("right" as const) : ("extra" as const)))
    : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", isStale && "opacity-60")}>
      <ActivityCanvasLabel className="font-medium" role="status">
        {result.columns.length === 0
          ? t("The query ran but didn't return a table. Use SELECT to get rows.")
          : t(
              "{count, plural, =0 {Your result has no rows} one {Your result: # row} other {Your result: # rows}}",
              { count: result.rows.length },
            )}
      </ActivityCanvasLabel>

      {result.columns.length > 0 && (
        <SqlRowsTable
          caption={t("Your result")}
          columns={result.columns}
          rowStates={rowStates}
          rows={result.rows}
        />
      )}

      {isStale && (
        <p className="text-muted-foreground text-xs">
          {t("You changed the query. Run it again to see the new result.")}
        </p>
      )}
    </div>
  );
}
