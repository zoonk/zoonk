"use client";

import { checkActivityAnswer } from "@zoonk/core/library/activities/answers";
import { type ActivityExpectedAnswer } from "@zoonk/core/library/activities/expected-answer";
import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import { ActivityCodeListing } from "../_components/activity-code";
import { type QueryResult, runQuery } from "../_sandbox/run-query";
import { compareRows } from "./sql-rows";
import { SqlRowsTable } from "./sql-table";

type SqlContent = ActivityContentFor<"sqlPlayground">;
type ExpectedRows = Extract<ActivityExpectedAnswer, { kind: "rows" }>;

/**
 * The reference query, shown only once code has run it and its result passes the same check the
 * learner's did, so a solution the writer got wrong is never shown as one that works.
 */
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

/**
 * After the check: the expected rows (computed by core from the fields) with the ones the
 * learner's result missed marked, the feedback for likely mistakes, and a query that works.
 */
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
        <ul className="flex flex-col gap-2">
          {content.fields.mistakes.map((item) => (
            <li
              className="bg-background rounded-2xl border px-3 py-2.5 text-sm leading-snug"
              key={item.mistake}
            >
              <p className="font-medium">
                <LessonRichText text={item.mistake} />
              </p>
              <p className="text-muted-foreground mt-0.5">
                <LessonRichText text={item.feedback} />
              </p>
            </li>
          ))}
        </ul>
      )}

      {solution && (
        <div className="flex flex-col gap-1.5">
          <ActivityCanvasLabel className="font-medium">
            {t("A query that works")}
          </ActivityCanvasLabel>
          <div className="bg-background rounded-2xl border px-3 py-2.5">
            <ActivityCodeListing code={solution} label={t("A query that works")} language="sql" />
          </div>
        </div>
      )}
    </div>
  );
}
