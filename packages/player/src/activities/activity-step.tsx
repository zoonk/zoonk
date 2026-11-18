"use client";

import { getActivityDecimalPlaces } from "@zoonk/core/library/activities/answers";
import { getActivityExpected } from "@zoonk/core/library/activities/expected";
import { useAppLocale } from "@zoonk/learn/locale";
import { NumericAnswerField } from "@zoonk/learn/numeric-answer-field";
import { cn } from "@zoonk/ui/lib/utils";
import { exactFractionDigitsFor } from "@zoonk/utils/localized-number";
import { getUnitPosition } from "@zoonk/utils/math-answer";
import { useId, useState } from "react";
import { InteractiveStepLayout } from "../components/step-layouts";
import { LessonQuestion } from "../lesson/_components/lesson-step-text";
import { useLessonPlayer } from "../lesson/lesson-player-context";
import { PlayerInteractionContext, usePlayerInteractionState } from "../player-context";
import { ActivityBadge } from "./_components/activity-badge";
import { ActivityCheckQuestion } from "./_components/activity-check-question";
import { ActivityChoiceCheck } from "./_components/activity-choice-check";
import { ActivityDataNote } from "./_components/activity-data-note";
import { ActivityFeedback } from "./_components/activity-feedback";
import { CanvasQuestionContext } from "./_utils/canvas-question";
import { activityRenderers } from "./activity-registry";
import { type ActivityStepProps } from "./activity-renderer";
import { BrowserCanvas } from "./browser-canvas";

function numericResult(isCorrect: boolean | null) {
  if (isCorrect === null) {
    return null;
  }

  return isCorrect ? "correct" : "wrong";
}

function ActivityCheckArea({
  answer,
  className,
  content,
  isCorrect,
  onAnswerChange,
  phase,
  places,
}: Pick<ActivityStepProps, "answer" | "content" | "isCorrect" | "onAnswerChange" | "phase"> & {
  className?: string;
  places: number | null;
}) {
  const { check } = content;
  const locale = useAppLocale();
  const questionId = useId();
  const { actions } = useLessonPlayer();

  if (check.kind === "choice") {
    return (
      <ActivityChoiceCheck
        answer={answer}
        check={check}
        className={className}
        onAnswerChange={onAnswerChange}
        phase={phase}
      />
    );
  }

  if (check.kind === "numeric") {
    const value = answer?.kind === "numeric" ? answer.value : null;

    const result = phase === "checked" ? numericResult(isCorrect) : null;

    return (
      <div className={cn("flex flex-col gap-3", className)} data-slot="activity-numeric-check">
        <ActivityCheckQuestion id={questionId}>{check.question}</ActivityCheckQuestion>
        <NumericAnswerField
          entry={places === null ? null : { kind: "decimals", places }}
          labelledBy={questionId}
          locked={phase === "checked"}
          maximumFractionDigits={exactFractionDigitsFor({
            expected: check.answer,
            tolerance: check.tolerance,
            value: value ?? check.answer,
          })}
          onChange={(number) =>
            onAnswerChange(number === null ? null : { kind: "numeric", value: number })
          }
          onSubmit={actions.check}
          result={result}
          unit={
            check.unit
              ? {
                  position: getUnitPosition({ language: locale, unit: check.unit }),
                  symbol: check.unit,
                }
              : null
          }
          value={value}
        />
      </div>
    );
  }

  return null;
}

export function ActivityStep({
  answer,
  content,
  isCorrect,
  isLocked = false,
  onAnswerChange,
  phase,
  picture,
}: ActivityStepProps) {
  const labelId = useId();
  const interactionState = usePlayerInteractionState();
  const { answersOnCanvas, badge } = activityRenderers[content.template];
  const places = getActivityDecimalPlaces(content);
  const expected = phase === "checked" ? getActivityExpected(content) : null;
  const badgeKind = badge(content);
  const [canvasAsks, setCanvasAsks] = useState(false);

  return (
    <InteractiveStepLayout data-slot="activity-step">
      <div className="flex flex-col gap-3">
        {badgeKind && <ActivityBadge kind={badgeKind} over={[content.prompt]} />}
        <LessonQuestion id={labelId}>{content.prompt}</LessonQuestion>
      </div>

      {picture}

      <fieldset className="flex min-w-0 flex-col gap-2" disabled={isLocked} inert={isLocked}>
        {/* `inert` stops clicks but not the window-level keys a canvas listens to. */}
        <PlayerInteractionContext value={isLocked ? "paused" : interactionState}>
          <CanvasQuestionContext value={setCanvasAsks}>
            <BrowserCanvas
              answer={answer}
              content={content}
              expected={expected}
              labelId={labelId}
              onAnswerChange={onAnswerChange}
              phase={phase}
            />
          </CanvasQuestionContext>
        </PlayerInteractionContext>

        <ActivityDataNote content={content} />
      </fieldset>

      {!canvasAsks && !answersOnCanvas && (
        <ActivityCheckArea
          isCorrect={isCorrect}
          answer={answer}
          className="pt-2"
          content={content}
          onAnswerChange={onAnswerChange}
          phase={phase}
          places={places}
        />
      )}

      {phase === "checked" && isCorrect !== null && (
        <ActivityFeedback
          answer={answer}
          content={content}
          isCorrect={isCorrect}
          places={places}
          showsNumbers={!answersOnCanvas}
        />
      )}
    </InteractiveStepLayout>
  );
}
