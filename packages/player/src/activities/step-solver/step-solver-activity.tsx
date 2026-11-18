"use client";

import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ActivityRendererProps } from "../activity-renderer";
import {
  type SolverPicks,
  addPick,
  currentStepIndex,
  firstPicks,
  picksFromFirst,
} from "./step-solver-progress";
import { StepSolverStep, type StepStatus } from "./step-solver-step";

type StepSolverProps = ActivityRendererProps<"stepSolver">;

function statusOf(index: number, current: number): StepStatus {
  if (index < current) {
    return "done";
  }

  return index === current ? "current" : "later";
}

export function StepSolverActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: StepSolverProps) {
  const t = useExtracted();
  const { check, fields } = content;

  const [picks, setPicks] = useState<SolverPicks>(() =>
    answer?.kind === "assignment" ? picksFromFirst(fields.steps, answer.pairs) : {},
  );

  const isChecked = phase === "checked";
  const current = isChecked ? fields.steps.length : currentStepIndex(fields.steps, picks);

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
      <RichTextBlocks className="text-base leading-snug [&>p]:font-medium" text={fields.problem} />

      <ol aria-label={t("Steps")} className="flex flex-col gap-5">
        {fields.steps.map((step, index) => (
          <StepSolverStep
            index={index}
            isChecked={isChecked}
            key={step.id}
            onPick={(choiceId) => handlePick(step.id, choiceId)}
            picks={picks[step.id] ?? []}
            status={statusOf(index, current)}
            step={step}
          />
        ))}
      </ol>

      <ActivityTextAlternative>
        {t("Step {current} of {total}.", {
          current: String(Math.min(current + 1, fields.steps.length)),
          total: String(fields.steps.length),
        })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
