"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivitySelectGrid, ActivitySelectGridItem } from "../_components/activity-select-grid";
import { type ActivityRendererProps } from "../activity-renderer";

type SolverStep = ActivityRendererProps<"stepSolver">["content"]["fields"]["steps"][number];
export type StepStatus = "done" | "current" | "later";

const BAR_MIN_PERCENT = 4;
const PERCENT = 100;

function StepMarker({
  index,
  isFirstPickWrong,
  status,
}: {
  index: number;
  isFirstPickWrong: boolean;
  status: StepStatus;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        status === "done" && !isFirstPickWrong && "bg-success text-background",
        status === "done" && isFirstPickWrong && "bg-destructive text-background",
        status === "current" && "bg-primary text-primary-foreground",
        status === "later" &&
          "border-border bg-background text-muted-foreground border-2 border-dashed",
      )}
    >
      {status === "done" && !isFirstPickWrong && <Check className="size-4" />}
      {status === "done" && isFirstPickWrong && <X className="size-4" />}
      {status !== "done" && index + 1}
    </span>
  );
}

/** The step's value as a bar against the biggest value in the problem, with its math. */
function StepWork({ maxValue, step }: { maxValue: number; step: SolverStep }) {
  const format = useFormatNumber();

  const width =
    maxValue === 0
      ? BAR_MIN_PERCENT
      : Math.max((Math.abs(step.value) / maxValue) * PERCENT, BAR_MIN_PERCENT);

  return (
    <div className="bg-muted/60 flex flex-col gap-2 rounded-2xl p-3">
      <div aria-hidden="true" className="flex items-center gap-2">
        <div className="bg-viz-accent-soft h-7 rounded-lg" style={{ width: `${width}%` }} />
        <span className="text-viz-accent shrink-0 text-sm font-semibold tabular-nums">
          {format(step.value, { unit: step.unit })}
        </span>
      </div>

      <p className="text-sm tabular-nums">
        <LessonRichText text={step.math} />
      </p>
    </div>
  );
}

/**
 * One step of the solver: its question and the moves to pick from, then, once the right move is
 * found, its picture and math. A wrong pick shows why it's wrong and stays marked.
 */
export function StepSolverStep({
  index,
  isChecked,
  maxValue,
  onPick,
  picks,
  status,
  step,
}: {
  index: number;
  isChecked: boolean;
  maxValue: number;
  onPick: (choiceId: string) => void;
  picks: readonly string[];
  status: StepStatus;
  step: SolverStep;
}) {
  const t = useExtracted();
  const correct = step.choices.find((choice) => choice.isCorrect);

  const wrongPicks = step.choices.filter(
    (choice) => picks.includes(choice.id) && !choice.isCorrect,
  );

  const lastWrong = wrongPicks.at(-1);
  const isFirstPickWrong = picks[0] !== undefined && picks[0] !== correct?.id;

  return (
    <li className="relative flex gap-3" data-slot="step-solver-step">
      <StepMarker index={index} isFirstPickWrong={isChecked && isFirstPickWrong} status={status} />

      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <p
          className={cn(
            "text-base font-semibold",
            status === "later" && "text-muted-foreground font-normal",
          )}
        >
          {status === "done" && correct ? (
            <LessonRichText text={correct.text} />
          ) : (
            <LessonRichText text={step.prompt} />
          )}
        </p>

        {status === "done" && <p className="text-muted-foreground text-sm">{step.prompt}</p>}

        {status === "current" && !isChecked && (
          <ActivitySelectGrid label={step.prompt}>
            {step.choices.map((choice) => (
              <ActivitySelectGridItem
                disabled={picks.includes(choice.id)}
                isSelected={false}
                key={choice.id}
                onToggle={() => onPick(choice.id)}
                resultState={picks.includes(choice.id) ? "incorrect" : null}
              >
                <LessonRichText text={choice.text} />
              </ActivitySelectGridItem>
            ))}
          </ActivitySelectGrid>
        )}

        {status === "current" && lastWrong && (
          <p aria-live="polite" className="text-sm leading-snug">
            <span className="text-destructive font-semibold">{t("Not quite:")}</span>{" "}
            {lastWrong.reason}
          </p>
        )}

        {status === "done" && correct && (
          <>
            <StepWork maxValue={maxValue} step={step} />
            <p className="text-sm leading-snug">
              <span className="text-success font-semibold">{t("Right:")}</span> {correct.reason}
            </p>
          </>
        )}

        {isChecked && isFirstPickWrong && wrongPicks[0] && (
          <p className="text-muted-foreground text-sm">
            {t("Your first pick: {choice}", { choice: wrongPicks[0].text })}
          </p>
        )}
      </div>
    </li>
  );
}
