"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { LessonRichText } from "@zoonk/learn/rich-text/lesson";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { NotQuiteLead } from "../../components/not-quite-lead";
import { ActivitySelectGrid, ActivitySelectGridItem } from "../_components/activity-select-grid";
import { type ActivityRendererProps } from "../activity-renderer";

type SolverStep = ActivityRendererProps<"stepSolver">["content"]["fields"]["steps"][number];
export type StepStatus = "done" | "current" | "later";

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
        status === "done" && !isFirstPickWrong && "bg-success-text text-background",
        status === "done" && isFirstPickWrong && "bg-destructive-text text-background",
        status === "current" && "bg-primary text-primary-foreground",
        status === "later" &&
          "border-border bg-background text-muted-foreground border border-dashed",
      )}
    >
      {status === "done" && !isFirstPickWrong && <Check className="size-4" />}
      {status === "done" && isFirstPickWrong && <X className="size-4" />}
      {status !== "done" && index + 1}
    </span>
  );
}

function StepWork({ step }: { step: SolverStep }) {
  const format = useFormatNumber();

  return (
    <div className="bg-muted/60 flex flex-col gap-2 rounded-xl p-3">
      <p className="text-viz-accent text-sm font-semibold tabular-nums">
        {format(step.value, { unit: step.unit })}
      </p>

      <p className="text-sm tabular-nums">
        <LessonRichText text={step.math} />
      </p>
    </div>
  );
}

function FirstPick({ text }: { text: string }) {
  const t = useExtracted();
  const choice = () => <LessonRichText text={text} />;

  return t.rich("Your first pick: <choice></choice>", { choice });
}

export function StepSolverStep({
  index,
  isChecked,
  onPick,
  picks,
  status,
  step,
}: {
  index: number;
  isChecked: boolean;
  onPick: (choiceId: string) => void;
  picks: readonly string[];
  status: StepStatus;
  step: SolverStep;
}) {
  const t = useExtracted();
  const spoken = useSpokenText();
  const correct = step.choices.find((choice) => choice.isCorrect);

  const wrongPicks = step.choices.filter(
    (choice) => picks.includes(choice.id) && !choice.isCorrect,
  );

  const lastWrong = wrongPicks.at(-1);
  const isFirstPickWrong = picks[0] !== undefined && picks[0] !== correct?.id;
  const firstWrongPick = isFirstPickWrong ? wrongPicks[0] : undefined;

  return (
    <li
      className="not-last:before:bg-border relative isolate flex gap-3 not-last:before:absolute not-last:before:top-4 not-last:before:-bottom-9 not-last:before:left-[15px] not-last:before:-z-10 not-last:before:w-0.5"
      data-slot="step-solver-step"
    >
      <StepMarker index={index} isFirstPickWrong={isChecked && isFirstPickWrong} status={status} />

      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <div
          className={cn(
            "text-base font-semibold",
            status === "later" && "text-muted-foreground font-normal",
          )}
        >
          <RichTextBlocks text={step.prompt} />
        </div>

        {/* The question keeps its place and its answer goes under it, so nothing reads backwards. */}
        {status === "done" && correct && (
          <p className="text-sm leading-snug font-medium">
            <LessonRichText text={correct.text} />
          </p>
        )}

        {status === "current" && !isChecked && (
          <ActivitySelectGrid label={spoken.blocks(step.prompt)}>
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
            <NotQuiteLead /> <LessonRichText text={lastWrong.reason} />
          </p>
        )}

        {status === "done" && correct && (
          <>
            <StepWork step={step} />
            <p className="text-sm leading-snug">
              <span className="text-success-text font-semibold">{t("Right:")}</span>{" "}
              <LessonRichText text={correct.reason} />
            </p>
          </>
        )}

        {isChecked && firstWrongPick && (
          <p className="text-muted-foreground text-sm">
            <FirstPick text={firstWrongPick.text} />
          </p>
        )}
      </div>
    </li>
  );
}
