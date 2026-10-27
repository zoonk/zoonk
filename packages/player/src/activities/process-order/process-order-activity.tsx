"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivitySortableList } from "../_components/activity-sortable-list";
import { type ActivityRendererProps } from "../activity-renderer";
import { type StepResult, shuffleSteps, stepResults } from "./process-order-model";
import { ProcessStepIcon } from "./process-step-icon";

type ProcessOrderProps = ActivityRendererProps<"processOrder">;
type ProcessStep = ProcessOrderProps["content"]["fields"]["steps"][number];

function PositionBadge({
  position,
  state,
}: {
  position: number;
  state: "correct" | "incorrect" | null;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
        state === null && "bg-muted text-foreground",
        state === "correct" && "bg-success-text text-background",
        state === "incorrect" && "bg-destructive-text text-white",
      )}
    >
      {position}
    </span>
  );
}

/**
 * The step's number and picture, as tall as the picture: a step's text starts level with them
 * and a long one wraps below, instead of the marks floating to the middle of it.
 */
function StepMarks({
  icon,
  position,
  state,
}: {
  icon: ProcessStep["icon"] | undefined;
  position: number;
  state: "correct" | "incorrect" | null;
}) {
  return (
    <span className="flex h-8 shrink-0 items-center gap-3">
      <PositionBadge position={position} state={state} />
      <ProcessStepIcon icon={icon} />
    </span>
  );
}

/**
 * One step in the true order, with why it comes here: after the check, marked right or wrong,
 * with where the learner had a misplaced one; explored on an explanation screen, unmarked.
 */
function OrderedStep({
  position,
  result,
  step,
}: {
  position: number;
  result?: StepResult;
  step: ProcessStep;
}) {
  const t = useExtracted();
  const state = result && (result.learnerPosition === result.position ? "correct" : "incorrect");

  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border px-3 py-2.5",
        state === "correct" && "border-success/50 bg-success/5",
        state === "incorrect" && "border-destructive/50 bg-destructive/5",
      )}
    >
      <StepMarks icon={step.icon} position={position} state={state ?? null} />

      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
        <p className="text-sm leading-snug font-medium">
          <LessonRichText text={step.text} />
        </p>

        {step.why && <p className="text-muted-foreground text-sm leading-snug">{step.why}</p>}

        {state === "incorrect" && result?.learnerPosition && (
          <p className="text-destructive-text text-xs font-medium">
            {t("You had it at {position}", { position: String(result.learnerPosition) })}
          </p>
        )}
      </div>
    </li>
  );
}

function initialOrder(answer: ProcessOrderProps["answer"], shuffled: readonly ProcessStep[]) {
  return answer?.kind === "order" ? answer.ids : shuffled.map((step) => step.id);
}

/**
 * The steps of a process, shuffled, to put in order by dragging or with the keyboard. Once
 * checked, they show in their true order with why each needs the one before, and where the
 * learner had the ones out of place. Explored on an explanation screen, they show in their true
 * order with each one's why, nothing to drag.
 */
export function ProcessOrderActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: ProcessOrderProps) {
  const t = useExtracted();
  const { steps } = content.fields;

  const shuffled = shuffleSteps(
    steps,
    `${content.prompt}:${steps.map((step) => step.id).join(",")}`,
  );

  const [order, setOrder] = useState(() => initialOrder(answer, shuffled));
  const byId = new Map(steps.map((step) => [step.id, step]));

  function handleReorder(ids: string[]) {
    setOrder(ids);
    onAnswerChange({ ids, kind: "order" });
  }

  // Explored or checked, the steps show in their true order; checked, each marked with the
  // learner's place for it (`stepResults` keeps that order).
  if (phase !== "answering") {
    const results =
      phase === "checked" ? stepResults({ expected: steps.map((step) => step.id), order }) : [];

    return (
      <ActivityCanvas className="gap-2" labelId={labelId}>
        {phase === "checked" && (
          <p className="text-muted-foreground text-xs font-medium">{t("The right order")}</p>
        )}

        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <OrderedStep key={step.id} position={index + 1} result={results[index]} step={step} />
          ))}
        </ol>
      </ActivityCanvas>
    );
  }

  return (
    <ActivityCanvas className="gap-2" labelId={labelId}>
      <ActivitySortableList
        items={order.flatMap((id) => {
          const step = byId.get(id);
          return step ? [{ id, label: step.text }] : [];
        })}
        label={t("Steps, in your order")}
        onReorder={handleReorder}
        renderItem={(item, index) => (
          <span className="flex min-w-0 flex-1 items-start gap-3">
            <StepMarks icon={byId.get(item.id)?.icon} position={index + 1} state={null} />
            <span className="min-w-0 flex-1 pt-1.5 text-sm leading-snug font-medium">
              <LessonRichText text={item.label} />
            </span>
          </span>
        )}
      />

      <p className="text-muted-foreground text-xs">{t("Drag the steps into order.")}</p>

      <ActivityTextAlternative>
        {t("{count, plural, one {# step} other {# steps}} to put in order.", {
          count: steps.length,
        })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
