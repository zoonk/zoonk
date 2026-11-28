"use client";

import { PROGRAM_LANGUAGES } from "@zoonk/core/library/activities/program-languages";
import { CodeFrame, CodeLine, CodeTokens } from "@zoonk/learn/code";
import { highlightCode } from "@zoonk/learn/code/highlight";
import { useSpokenCode } from "@zoonk/learn/code/spoken";
import { useAppLocale } from "@zoonk/learn/locale";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonHelpLimitNotice } from "../../lesson/_components/help-limit-notice";
import {
  ACTIVITY_BOX_CLASS,
  ActivityCanvas,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { ActivityCodeLineInput } from "../_components/activity-code";
import { SandboxRunBar } from "../_sandbox/sandbox-run-bar";
import { type ActivityRendererProps } from "../activity-renderer";
import { CodeRunnerOutput } from "./code-runner-output";
import { mistakeFor, programWithEdits, sameOutput } from "./code-runner-program";
import { useCodeRun } from "./use-code-run";

type CodeRunnerProps = ActivityRendererProps<"codeRunner">;

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
  const spoken = useSpokenCode();
  const { fields } = content;
  const { language } = fields;
  const isChecked = phase === "checked";
  const isExploring = phase === "explore";
  const [edits, setEdits] = useState<Record<number, string>>({});
  const codeRun = useCodeRun({ answer, isChecked, language, onAnswerChange });
  const { isRunning, isStale, run } = codeRun;
  const matches = run !== null && sameOutput(run.output, fields.expectedOutput);
  const edited = Object.keys(edits).length > 0;
  const program = programWithEdits(baseProgram({ edited, fields, matches, phase }), edits);
  const lines = program.split("\n");
  const highlighted = highlightCode(program, language);
  const editable = new Set(fields.editableLines);
  const runtimeName = PROGRAM_LANGUAGES[language].name;

  const mistake =
    run && !matches && !isExploring
      ? (mistakeFor(run.output, fields.mistakes)?.feedback ?? null)
      : null;

  function handleRun() {
    void codeRun.start(program);
  }

  function edit(lineNumber: number, value: string) {
    setEdits((current) => ({ ...current, [lineNumber]: value }));

    codeRun.edit();
    onAnswerChange(null);
  }

  function reset() {
    setEdits({});

    codeRun.edit();
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
            {fields.fileName ?? PROGRAM_LANGUAGES[language].fileName}
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

        <CodeFrame field label={t("Code")} lineCount={lines.length}>
          {lines.map((line, index) => {
            const number = index + 1;

            const canEdit = editable.has(number) && !isChecked;
            const hasError = run?.error?.line === number && !isStale;

            return (
              <CodeLine
                key={number}
                number={number}
                spoken={canEdit ? undefined : spoken.line(line, number)}
                tone={runnerLineTone({ canEdit, hasError })}
              >
                {canEdit ? (
                  <ActivityCodeLineInput
                    aria-label={t("Line {number}, yours to edit", { number: String(number) })}
                    language={language}
                    onChange={(value) => edit(number, value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleRun();
                      }
                    }}
                    value={line}
                  />
                ) : (
                  <CodeTokens tokens={highlighted[index] ?? []} />
                )}
              </CodeLine>
            );
          })}
        </CodeFrame>
      </div>

      <CodeRunnerOutput
        expectedOutput={isExploring ? null : fields.expectedOutput}
        isStale={isStale}
        language={language}
        matches={matches}
        mistake={mistake}
        run={run}
      />

      {!isChecked && (
        <div aria-live="polite" className="empty:hidden">
          {codeRun.limit && <LessonHelpLimitNotice kind="runs" limit={codeRun.limit} />}
        </div>
      )}

      {!isChecked && (
        <SandboxRunBar
          hasRun={run !== null}
          isRunning={isRunning}
          isExploring={isExploring}
          onReset={Object.keys(edits).length > 0 ? reset : undefined}
          onRetry={codeRun.runsOnServer ? handleRun : codeRun.retryRuntime}
          onRun={handleRun}
          phase={codeRun.phase}
          problem={codeRun.problem}
          runtimeName={runtimeName}
          runtimeStatus={codeRun.runtimeStatus}
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
