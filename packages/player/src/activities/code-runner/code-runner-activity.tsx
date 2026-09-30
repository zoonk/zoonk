"use client";

import { Pencil } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import {
  ActivityCodeBlock,
  ActivityCodeLine,
  ActivityCodeLineInput,
  ActivityCodeTokens,
} from "../_components/activity-code";
import { type ProgramRun, runProgram } from "../_sandbox/run-program";
import { SandboxRunBar } from "../_sandbox/sandbox-run-bar";
import { useSandboxRuntime } from "../_sandbox/use-sandbox-runtime";
import { highlightCode } from "../_utils/highlight-code";
import { type ActivityRendererProps } from "../activity-renderer";
import { CodeRunnerOutput } from "./code-runner-output";
import { mistakeFor, programWithEdits, sameOutput } from "./code-runner-program";

type CodeRunnerProps = ActivityRendererProps<"codeRunner">;

const RUNTIME_NAMES = { javascript: "JavaScript", python: "Python" } as const;
const DEFAULT_FILE_NAMES = { javascript: "main.js", python: "main.py" } as const;

/**
 * Real code in the browser: the learner edits the lines that are theirs, runs the program and
 * compares what it prints with what it should print. The output of the last run is the answer,
 * so editing after a run waits for the next run. Likely mistakes explain themselves by what
 * they print; errors point at their line.
 */
/** A saved output from an earlier visit, shown as the last run. */
function runFromAnswer(answer: CodeRunnerProps["answer"]): ProgramRun | null {
  return answer?.kind === "output"
    ? { error: null, errorOutput: "", output: answer.output, stop: "done" }
    : null;
}

export function CodeRunnerActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: CodeRunnerProps) {
  const t = useExtracted();
  const locale = useLocale();
  const { fields } = content;
  const isChecked = phase === "checked";
  const runtime = useSandboxRuntime(fields.language);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [run, setRun] = useState<ProgramRun | null>(() => runFromAnswer(answer));
  const [isRunning, setIsRunning] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const program = programWithEdits(fields.starterCode, edits);
  const lines = program.split("\n");
  const highlighted = highlightCode(program, fields.language);
  const editable = new Set(fields.editableLines);
  const runtimeName = RUNTIME_NAMES[fields.language];
  const matches = run !== null && sameOutput(run.output, fields.expectedOutput);

  const mistake =
    run && !matches ? (mistakeFor(run.output, fields.mistakes)?.feedback ?? null) : null;

  async function handleRun() {
    if (isChecked || isRunning) {
      return;
    }

    setIsRunning(true);
    const result = await runProgram({ code: program, language: fields.language });
    setRun(result);
    setIsStale(false);
    setIsRunning(false);

    onAnswerChange(
      result.stop === "unavailable" ? null : { kind: "output", output: result.output },
    );
  }

  function edit(lineNumber: number, value: string) {
    setEdits((current) => ({ ...current, [lineNumber]: value }));

    if (run) {
      setIsStale(true);
      onAnswerChange(null);
    }
  }

  function reset() {
    setEdits({});

    if (run) {
      setIsStale(true);
      onAnswerChange(null);
    }
  }

  const yours = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    fields.editableLines.map(String),
  );

  return (
    <ActivityCanvas className="gap-3" labelId={labelId}>
      <div className="bg-background flex flex-col gap-2 rounded-3xl border px-3 pt-3 pb-3.5">
        <div className="flex items-center justify-between gap-3 px-1.5">
          <p className="text-muted-foreground font-mono text-xs">
            {fields.fileName ?? DEFAULT_FILE_NAMES[fields.language]}
          </p>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Pencil aria-hidden="true" className="size-3" />
            {t("{count, plural, one {Line {lines} is yours} other {Lines {lines} are yours}}", {
              count: fields.editableLines.length,
              lines: yours,
            })}
          </p>
        </div>

        <ActivityCodeBlock aria-label={t("Code")} role="group">
          {lines.map((line, index) => {
            const number = index + 1;

            if (!editable.has(number)) {
              return (
                <ActivityCodeLine
                  key={number}
                  number={number}
                  tone={run?.error?.line === number && !isStale ? "error" : "plain"}
                >
                  <ActivityCodeTokens tokens={highlighted[index] ?? []} />
                </ActivityCodeLine>
              );
            }

            return (
              <ActivityCodeLine
                key={number}
                number={number}
                tone={run?.error?.line === number && !isStale ? "error" : "editable"}
              >
                <ActivityCodeLineInput
                  aria-label={t("Line {number}, yours to edit", { number: String(number) })}
                  language={fields.language}
                  onChange={(value) => edit(number, value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleRun();
                    }
                  }}
                  readOnly={isChecked}
                  value={line}
                />
              </ActivityCodeLine>
            );
          })}
        </ActivityCodeBlock>
      </div>

      <CodeRunnerOutput
        expectedOutput={fields.expectedOutput}
        isStale={isStale}
        language={fields.language}
        matches={matches}
        mistake={mistake}
        run={run}
      />

      {!isChecked && (
        <SandboxRunBar
          hasRun={run !== null}
          isRunning={isRunning}
          onReset={Object.keys(edits).length > 0 ? reset : undefined}
          onRetry={runtime.retry}
          onRun={() => void handleRun()}
          runtimeName={runtimeName}
          runtimeStatus={runtime.status}
        />
      )}

      <ActivityTextAlternative>
        {t(
          "A {language} program of {count} lines. Edit your lines, run it, and compare its output with the expected output: {expected}",
          { count: String(lines.length), expected: fields.expectedOutput, language: runtimeName },
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
