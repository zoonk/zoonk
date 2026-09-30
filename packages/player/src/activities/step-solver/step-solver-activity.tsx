"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ActivityRendererProps } from "../activity-renderer";
import { type SolverPicks, addPick, currentStepIndex, firstPicks } from "./step-solver-progress";
import { StepSolverStep, type StepStatus } from "./step-solver-step";

type StepSolverProps = ActivityRendererProps<"stepSolver">;

function statusOf(index: number, current: number): StepStatus {
  if (index < current) {
    return "done";
  }

  return index === current ? "current" : "later";
}

/**
 * A problem solved one step at a time: the learner picks each next move and sees it as a bar and
 * as math. Wrong picks explain themselves and can be retried, but the answer keeps each step's
 * first pick. A numeric check reads the value code computes for the target step.
 */
export function StepSolverActivity({ content, labelId, onAnswerChange, phase }: StepSolverProps) {
  const t = useExtracted();
  const { check, fields } = content;
  const [picks, setPicks] = useState<SolverPicks>({});
  const isChecked = phase === "checked";
  const current = isChecked ? fields.steps.length : currentStepIndex(fields.steps, picks);
  const maxValue = Math.max(...fields.steps.map((step) => Math.abs(step.value)));

  function handlePick(stepId: string, choiceId: string) {
    const next = addPick(picks, stepId, choiceId);
    const pairs = firstPicks(fields.steps, next);
    setPicks(next);

    if (!pairs) {
      onAnswerChange(null);
      return;
    }

    if (check.kind === "numeric") {
      const value = computeActivityValue(content, { output: check.output });
      onAnswerChange(value === null ? null : { kind: "numeric", value });
      return;
    }

    onAnswerChange({ kind: "assignment", pairs });
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <p className="text-base leading-snug font-medium">
        <LessonRichText text={fields.problem} />
      </p>

      <div className="relative">
        <div aria-hidden="true" className="bg-border absolute top-4 bottom-4 left-[15px] w-0.5" />

        <ol aria-label={t("Steps")} className="flex flex-col gap-5">
          {fields.steps.map((step, index) => (
            <StepSolverStep
              index={index}
              isChecked={isChecked}
              key={step.id}
              maxValue={maxValue}
              onPick={(choiceId) => handlePick(step.id, choiceId)}
              picks={picks[step.id] ?? []}
              status={statusOf(index, current)}
              step={step}
            />
          ))}
        </ol>
      </div>

      <ActivityTextAlternative>
        {t("Step {current} of {total}.", {
          current: String(Math.min(current + 1, fields.steps.length)),
          total: String(fields.steps.length),
        })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
