"use client";

import { useAppLocale } from "@zoonk/learn/locale";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ACTIVITY_BOX_CLASS,
  ActivityCanvas,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import {
  ActivityCodeBlock,
  ActivityCodeLine,
  ActivityCodeLineInput,
  ActivityCodeTokens,
} from "../_components/activity-code";
import { type ProgramRun, runProgram } from "../_sandbox/run-program";
import { SandboxRunBar } from "../_sandbox/sandbox-run-bar";
import { useEditorRun } from "../_sandbox/use-editor-run";
import { useSandboxRuntime } from "../_sandbox/use-sandbox-runtime";
import { highlightCode } from "../_utils/highlight-code";
import { type ActivityRendererProps } from "../activity-renderer";
import { CodeRunnerOutput } from "./code-runner-output";
import { mistakeFor, programWithEdits, sameOutput } from "./code-runner-program";

type CodeRunnerProps = ActivityRendererProps<"codeRunner">;

const RUNTIME_NAMES = { javascript: "JavaScript", python: "Python" } as const;
const DEFAULT_FILE_NAMES = { javascript: "main.js", python: "main.py" } as const;

function runFromAnswer(answer: CodeRunnerProps["answer"]): ProgramRun | null {
  return answer?.kind === "output"
    ? { error: null, errorOutput: "", output: answer.output, stop: "done" }
    : null;
}

/** A right answer opened again keeps only its output, so the program that prints it is the solution. */
function baseProgram({
  edited,
  fields,
  matches,
  phase,
}: {
  edited: boolean;
  fields: CodeRunnerProps["content"]["fields"];
  matches: boolean;
  phase: CodeRunnerProps["phase"];
}): string {
  const reopenedRight = phase === "checked" && matches && !edited;
  return phase === "explore" || reopenedRight ? fields.solution : fields.starterCode;
}

function runnerLineTone({ canEdit, hasError }: { canEdit: boolean; hasError: boolean }) {
  if (hasError) {
    return "error";
  }

  return canEdit ? "editable" : "plain";
}

export function CodeRunnerActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: CodeRunnerProps) {
  const t = useExtracted();
  const locale = useAppLocale();
  const { fields } = content;
  const isChecked = phase === "checked";
  const isExploring = phase === "explore";
  const runtime = useSandboxRuntime(fields.language);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [run, setRun] = useState<ProgramRun | null>(() => runFromAnswer(answer));
  const editorRun = useEditorRun({ isChecked });
  const { isRunning, isStale } = editorRun;
  const matches = run !== null && sameOutput(run.output, fields.expectedOutput);
  const edited = Object.keys(edits).length > 0;
  const program = programWithEdits(baseProgram({ edited, fields, matches, phase }), edits);
  const lines = program.split("\n");
  const highlighted = highlightCode(program, fields.language);
  const editable = new Set(fields.editableLines);
  const runtimeName = RUNTIME_NAMES[fields.language];

  const mistake =
    run && !matches && !isExploring
      ? (mistakeFor(run.output, fields.mistakes)?.feedback ?? null)
      : null;

  async function handleRun() {
    if (isChecked || isRunning) {
      return;
    }

    const revision = editorRun.start();

    if (revision === null) {
      return;
    }

    const result = await runProgram({ code: program, language: fields.language });
    const status = editorRun.finish(revision);

    if (status === "cancelled") {
      return;
    }

    setRun(result);

    onAnswerChange(
      status !== "current" || result.stop === "unavailable"
        ? null
        : { kind: "output", output: result.output },
    );
  }

  function edit(lineNumber: number, value: string) {
    setEdits((current) => ({ ...current, [lineNumber]: value }));

    editorRun.edit();
    onAnswerChange(null);
  }

  function reset() {
    setEdits({});

    editorRun.edit();
    onAnswerChange(null);
  }

  const yours = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    fields.editableLines.map(String),
  );

  return (
    <ActivityCanvas className="gap-3" labelId={labelId}>
      <div className={cn(ACTIVITY_BOX_CLASS, "flex flex-col gap-2 px-3 pt-3 pb-3.5")}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground font-mono text-xs">
            {fields.fileName ?? DEFAULT_FILE_NAMES[fields.language]}
          </p>
          {!isExploring && (
            <p className="text-muted-foreground flex items-center gap-1 text-xs in-data-[phase=feedback]:invisible">
              {t("{count, plural, one {Edit line {lines}} other {Edit lines {lines}}}", {
                count: fields.editableLines.length,
                lines: yours,
              })}
            </p>
          )}
        </div>

        <ActivityCodeBlock label={t("Code")}>
          {lines.map((line, index) => {
            const number = index + 1;

            const canEdit = editable.has(number) && !isChecked;
            const hasError = run?.error?.line === number && !isStale;

            return (
              <ActivityCodeLine
                key={number}
                number={number}
                tone={runnerLineTone({ canEdit, hasError })}
              >
                {canEdit ? (
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
                    value={line}
                  />
                ) : (
                  <ActivityCodeTokens tokens={highlighted[index] ?? []} />
                )}
              </ActivityCodeLine>
            );
          })}
        </ActivityCodeBlock>
      </div>

      <CodeRunnerOutput
        expectedOutput={isExploring ? null : fields.expectedOutput}
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
          isExploring={isExploring}
          onReset={Object.keys(edits).length > 0 ? reset : undefined}
          onRetry={runtime.retry}
          onRun={() => void handleRun()}
          runtimeName={runtimeName}
          runtimeStatus={runtime.status}
        />
      )}

      <ActivityTextAlternative>
        {isExploring
          ? t(
              "A {language} program of {count, plural, one {# line} other {# lines}}. Run it to see what it prints.",
              { count: lines.length, language: runtimeName },
            )
          : t(
              "A {language} program of {count, plural, one {# line} other {# lines}}. Edit your lines, run it, and compare its output with the expected output: {expected}",
              { count: lines.length, expected: fields.expectedOutput, language: runtimeName },
            )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
