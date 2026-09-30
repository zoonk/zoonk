"use client";

import { checkActivityAnswer } from "@zoonk/core/library/activities/answers";
import { PROGRAM_TIME_LIMIT_MS } from "@zoonk/core/library/activities/program-limits";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import {
  ActivityCodeEditor,
  ActivitySnippetBar,
  useInsertSnippet,
} from "../_components/activity-code";
import { type QueryResult, type QueryRun, runQuery } from "../_sandbox/run-query";
import { SandboxRunBar } from "../_sandbox/sandbox-run-bar";
import { useSandboxRuntime } from "../_sandbox/use-sandbox-runtime";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { SqlResult } from "./sql-result";
import { SqlReview } from "./sql-review";
import { sqlSnippets } from "./sql-snippets";
import { SqlTableViewer } from "./sql-table";

type SqlPlaygroundProps = ActivityRendererProps<"sqlPlayground">;

type QueryState =
  | { message: string; status: "error" }
  | { result: QueryResult; status: "done" }
  | null;

const MS_PER_SECOND = 1000;
const RUNTIME_NAME = "SQLite";

function stateFromAnswer(answer: SqlPlaygroundProps["answer"]): QueryState {
  return answer?.kind === "rows"
    ? { result: { columns: answer.columns, rows: answer.rows }, status: "done" }
    : null;
}

/**
 * Query the lesson's tables with real SQLite in the browser. The learner writes a query, runs
 * it and reads the result; the rows of the last run are the answer. After the check, missing
 * and extra rows are marked against the expected result, with a query that works.
 */
export function SqlPlaygroundActivity({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: SqlPlaygroundProps) {
  const t = useExtracted();
  const editorId = useId();
  const { fields } = content;
  const isChecked = phase === "checked";
  const runtime = useSandboxRuntime("sql");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<QueryState>(() => stateFromAnswer(answer));
  const [isRunning, setIsRunning] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const expectedRows = expectedInteraction(expected, "rows");
  const result = state?.status === "done" ? state.result : null;

  const snippets = sqlSnippets(fields.tables);

  function change(next: string) {
    setQuery(next);

    if (state) {
      setIsStale(true);
      onAnswerChange(null);
    }
  }

  const { fieldRef, insert } = useInsertSnippet({ onChange: change, value: query });

  function runErrorMessage(run: Exclude<QueryRun, { status: "done" }>): string {
    if (run.status === "error") {
      return run.message;
    }

    return run.status === "timeout"
      ? t("The query took more than {seconds} seconds and was stopped.", {
          seconds: String(PROGRAM_TIME_LIMIT_MS.sql / MS_PER_SECOND),
        })
      : t("SQLite didn't load. Check your connection and try again.");
  }

  async function handleRun() {
    if (isChecked || isRunning || !query.trim()) {
      return;
    }

    setIsRunning(true);
    const run = await runQuery({ query, tables: fields.tables });
    setIsRunning(false);
    setIsStale(false);

    if (run.status === "done") {
      setState(run);
      onAnswerChange({ columns: run.result.columns, kind: "rows", rows: run.result.rows });
      return;
    }

    setState({ message: runErrorMessage(run), status: "error" });
    onAnswerChange(null);
  }

  const isCorrect =
    result !== null &&
    checkActivityAnswer(content, { columns: result.columns, kind: "rows", rows: result.rows });

  return (
    <ActivityCanvas className="gap-3" labelId={labelId}>
      <div className="flex flex-col gap-2">
        {fields.tables.map((table) => (
          <SqlTableViewer key={table.name} table={table} />
        ))}
      </div>

      {!isChecked && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor={editorId}>
            {t("Your query")}
          </label>

          <ActivityCodeEditor
            editorRef={fieldRef}
            id={editorId}
            language="sql"
            onChange={change}
            onSubmit={() => void handleRun()}
            placeholder="SELECT"
            value={query}
          />

          <ActivitySnippetBar
            label={t("SQL words, tables and columns")}
            onInsert={insert}
            snippets={snippets}
          />

          <SandboxRunBar
            hasRun={state !== null}
            isRunning={isRunning}
            onRetry={runtime.retry}
            onRun={() => void handleRun()}
            runtimeName={RUNTIME_NAME}
            runtimeStatus={runtime.status}
          />
        </div>
      )}

      {state?.status === "error" && !isStale && (
        <p className="text-destructive font-mono text-sm" role="status">
          {state.message}
        </p>
      )}

      {result && (
        <SqlResult expected={isChecked ? expectedRows : null} isStale={isStale} result={result} />
      )}

      {isChecked && expectedRows && (
        <SqlReview
          content={content}
          expected={expectedRows}
          isCorrect={isCorrect}
          result={result}
        />
      )}

      <ActivityTextAlternative>
        {t("Tables to query: {tables}. Write a SQL query, run it, and read the result.", {
          tables: fields.tables
            .map(
              (table) => `${table.name} (${table.columns.map((column) => column.name).join(", ")})`,
            )
            .join("; "),
        })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
