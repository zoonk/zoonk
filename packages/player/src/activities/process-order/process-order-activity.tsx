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
        state === "correct" && "bg-success text-background",
        state === "incorrect" && "bg-destructive text-white",
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

/** One step in the true order after the check: why it comes here, and where the learner had it. */
function CheckedStep({ result, step }: { result: StepResult; step: ProcessStep }) {
  const t = useExtracted();
  const isRight = result.learnerPosition === result.position;

  return (
    <li
      className={cn(
        "flex gap-3 rounded-2xl border px-3 py-2.5",
        isRight ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5",
      )}
    >
      <StepMarks
        icon={step.icon}
        position={result.position}
        state={isRight ? "correct" : "incorrect"}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
        <p className="text-sm leading-snug font-medium">
          <LessonRichText text={step.text} />
        </p>

        {step.why && <p className="text-muted-foreground text-sm leading-snug">{step.why}</p>}

        {!isRight && result.learnerPosition !== null && (
          <p className="text-destructive text-xs font-medium">
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
 * learner had the ones out of place.
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

  if (phase === "checked") {
    const results = stepResults({ expected: steps.map((step) => step.id), order });

    return (
      <ActivityCanvas className="gap-2" labelId={labelId}>
        <p className="text-muted-foreground text-xs font-medium">{t("The right order")}</p>

        <ol className="flex flex-col gap-2">
          {results.map((result) => {
            const step = byId.get(result.id);
            return step ? <CheckedStep key={result.id} result={result} step={step} /> : null;
          })}
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
