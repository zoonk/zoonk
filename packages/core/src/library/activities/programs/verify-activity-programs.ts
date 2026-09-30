import "server-only";
import { checkActivityAnswer } from "../activity-answers";
import { type ActivityStepContent } from "../activity-templates";
import { type ActivityIssue } from "../define-activity-template";
import { issue } from "../templates/_utils/template-helpers";
import { instrumentJavaScript } from "./instrument-javascript";
import { MAX_TRACE_STEPS, PROGRAM_TIME_LIMIT_MS, type ProgramKind } from "./program-limits";
import { type ProgramRun } from "./program-runs";
import { type ProgramJob, runPrograms } from "./run-programs";
import { sqlSetupStatements } from "./sql-setup";
import { findTraceMismatch } from "./trace-match";

const MS_PER_SECOND = 1000;
const PREVIEW_LENGTH = 300;
const PREVIEW_ROWS = 10;

/** The programs an activity needs run, and how their runs become issues. */
type ProgramCheck = { jobs: ProgramJob[]; judge: (runs: readonly ProgramRun[]) => ActivityIssue[] };

type ContentOf<TTemplate extends ActivityStepContent["template"]> = Extract<
  ActivityStepContent,
  { template: TTemplate }
>;

function preview(text: string): string {
  return JSON.stringify(text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text);
}

function failure(run: ProgramRun, kind: ProgramKind): string | null {
  switch (run.status) {
    case "crashed":
      return "stopped the checker, likely by using too much memory";
    case "error": {
      const line = run.error?.line ? ` on line ${run.error.line}` : "";
      return `fails${line}: ${run.error?.message ?? "unknown error"}`;
    }
    case "timeout":
      return `doesn't finish within ${PROGRAM_TIME_LIMIT_MS[kind] / MS_PER_SECOND} seconds`;
    case "tooManySteps":
      return `runs more than ${MAX_TRACE_STEPS} lines; trace a shorter program`;
    case "tooMuchOutput":
      return "prints far more than a lesson shows";
    case "done":
      return null;
    default:
      return null;
  }
}

/** A run that didn't finish cleanly, as an issue on the field holding its code. */
function runIssues({
  kind,
  path,
  run,
  what,
}: {
  kind: ProgramKind;
  path: string;
  run: ProgramRun | undefined;
  what: string;
}): ActivityIssue[] {
  const problem = run ? failure(run, kind) : null;
  return problem ? [issue("programFails", path, `${what} ${problem}`)] : [];
}

function codeRunnerCheck(content: ContentOf<"codeRunner">): ProgramCheck {
  const { language, solution, starterCode } = content.fields;

  const printsExpected = (run: ProgramRun | undefined) =>
    run?.status === "done" && checkActivityAnswer(content, { kind: "output", output: run.output });

  return {
    jobs: [
      { code: solution, kind: language },
      { code: starterCode, kind: language },
    ],
    judge: ([solutionRun, starterRun]) => [
      ...runIssues({
        kind: language,
        path: "fields.solution",
        run: solutionRun,
        what: "The solution",
      }),
      ...(solutionRun?.status === "done" && !printsExpected(solutionRun)
        ? [
            issue(
              "answerMismatch",
              "fields.expectedOutput",
              `The solution prints ${preview(solutionRun.output)}; the expected output must be exactly what it prints`,
            ),
          ]
        : []),
      ...(printsExpected(starterRun)
        ? [
            issue(
              "missingInteraction",
              "fields.starterCode",
              "The starter code already prints the expected output; leave the learner something to fix",
            ),
          ]
        : []),
    ],
  };
}

function codeTracerCheck(content: ContentOf<"codeTracer">): ProgramCheck {
  const { code, language, trace, watch } = content.fields;
  const instrumented = language === "javascript" ? instrumentJavaScript({ code, watch }) : null;

  if (instrumented && !instrumented.ok) {
    const { line, message } = instrumented.error;
    const at = line ? ` on line ${line}` : "";

    return {
      jobs: [],
      judge: () => [issue("programFails", "fields.code", `The code fails${at}: ${message}`)],
    };
  }

  const job: ProgramJob = instrumented
    ? { code: instrumented.code, kind: "javascript" }
    : { code, kind: "python", watch };

  return {
    jobs: [job],
    judge: ([run]) => {
      const mismatch = run
        ? findTraceMismatch({ events: run.steps, language, trace, watch })
        : null;

      return [
        ...runIssues({ kind: language, path: "fields.code", run, what: "The code" }),
        ...(mismatch
          ? [issue("answerMismatch", `fields.trace.${mismatch.index}`, mismatch.message)]
          : []),
      ];
    },
  };
}

function describeTable(table: NonNullable<ProgramRun["table"]>): string {
  const more = table.rows.length > PREVIEW_ROWS ? ` (${table.rows.length} rows in all)` : "";
  return `columns ${JSON.stringify(table.columns)} and rows ${JSON.stringify(table.rows.slice(0, PREVIEW_ROWS))}${more}`;
}

function sqlPlaygroundCheck(content: ContentOf<"sqlPlayground">): ProgramCheck {
  const { solution, tables } = content.fields;

  return {
    jobs: [{ kind: "sql", query: solution, setup: sqlSetupStatements(tables) }],
    judge: ([run]) => {
      const table = run?.status === "done" ? run.table : null;

      const matches =
        table === null ||
        checkActivityAnswer(content, { columns: table.columns, kind: "rows", rows: table.rows });

      return [
        ...runIssues({ kind: "sql", path: "fields.solution", run, what: "The solution query" }),
        ...(table && !matches
          ? [
              issue(
                "answerMismatch",
                "fields.expected",
                `The solution returns ${describeTable(table)}; the expected result must match it exactly`,
              ),
            ]
          : []),
      ];
    },
  };
}

function programCheck(content: ActivityStepContent): ProgramCheck {
  if (content.template === "codeRunner") {
    return codeRunnerCheck(content);
  }

  if (content.template === "codeTracer") {
    return codeTracerCheck(content);
  }

  return content.template === "sqlPlayground"
    ? sqlPlaygroundCheck(content)
    : { jobs: [], judge: () => [] };
}

/**
 * Runs the code in code activities before they're published, so their answers are computed
 * rather than written: a code runner's solution must print the expected output (and its
 * starter code must not), a code tracer's trace must match a real run, and a SQL playground's
 * solution must return the expected rows. Programs run like the player runs them, in
 * WebAssembly runtimes outside the server's process. Returns each activity's issues, in order,
 * in the validator's format for the writer's fix step; other templates have none.
 */
export async function verifyActivityPrograms(
  contents: readonly ActivityStepContent[],
): Promise<ActivityIssue[][]> {
  const checks = contents.map((content) => programCheck(content));
  const runs = await runPrograms(checks.flatMap((check) => check.jobs));

  const starts = checks.map((_, index) =>
    checks.slice(0, index).reduce((total, check) => total + check.jobs.length, 0),
  );

  return checks.map((check, index) =>
    check.judge(runs.slice(starts[index], (starts[index] ?? 0) + check.jobs.length)),
  );
}
