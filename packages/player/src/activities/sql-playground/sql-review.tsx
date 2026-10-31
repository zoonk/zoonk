"use client";

import { checkActivityAnswer } from "@zoonk/core/library/activities/answers";
import { type ActivityExpectedAnswer } from "@zoonk/core/library/activities/expected-answer";
import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import { ActivityCodeListing } from "../_components/activity-code";
import { ActivityReason, ActivityReasons } from "../_components/activity-reasons";
import { type QueryResult, runQuery } from "../_sandbox/run-query";
import { compareRows } from "./sql-rows";
import { SqlRowsTable } from "./sql-table";

type SqlContent = ActivityContentFor<"sqlPlayground">;
type ExpectedRows = Extract<ActivityExpectedAnswer, { kind: "rows" }>;

function useVerifiedSolution(content: SqlContent): string | null {
  const [verified, setVerified] = useState<string | null>(null);

  useEffect(() => {
    const subscription = { isActive: true };

    void runQuery({ query: content.fields.solution, tables: content.fields.tables }).then((run) => {
      const works =
        run.status === "done" &&
        checkActivityAnswer(content, {
          columns: run.result.columns,
          kind: "rows",
          rows: run.result.rows,
        });

      if (subscription.isActive && works) {
        setVerified(content.fields.solution);
      }
    });

    return () => {
      subscription.isActive = false;
    };
  }, [content]);

  return verified;
}

export function SqlReview({
  content,
  expected,
  isCorrect,
  result,
}: {
  content: SqlContent;
  expected: ExpectedRows;
  isCorrect: boolean;
  result: QueryResult | null;
}) {
  const t = useExtracted();
  const solution = useVerifiedSolution(content);

  const { expectedFound } = compareRows({
    actual: result?.rows ?? [],
    expected: expected.rows,
    orderMatters: expected.orderMatters,
  });

  return (
    <div className="flex flex-col gap-4" data-slot="sql-review">
      {!isCorrect && (
        <div className="flex flex-col gap-1.5">
          <ActivityCanvasLabel className="font-medium">
            {expected.orderMatters ? t("Expected result, in this order") : t("Expected result")}
          </ActivityCanvasLabel>
          <SqlRowsTable
            caption={t("Expected result")}
            columns={expected.columns}
            rowStates={expectedFound.map((found) => (found ? "plain" : "missing"))}
            rows={expected.rows}
          />
        </div>
      )}

      {!isCorrect && content.fields.mistakes.length > 0 && (
        <ActivityReasons>
          {content.fields.mistakes.map((item) => (
            <ActivityReason key={item.mistake} why={item.feedback}>
              <span className="font-medium">
                <LessonRichText text={item.mistake} />
              </span>
            </ActivityReason>
          ))}
        </ActivityReasons>
      )}

      {solution && (
        <div className="flex flex-col gap-1.5">
          <ActivityCanvasLabel className="font-medium">
            {t("A query that works")}
          </ActivityCanvasLabel>
          <div className="bg-background rounded-xl border px-3 py-2.5">
            <ActivityCodeListing code={solution} label={t("A query that works")} language="sql" />
          </div>
        </div>
      )}
    </div>
  );
}
