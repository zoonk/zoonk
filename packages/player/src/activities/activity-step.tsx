"use client";

import {
  getActivityRoundedAnswer,
  getCheckedAnswerDigits,
} from "@zoonk/core/library/activities/answers";
import { getActivityExpected } from "@zoonk/core/library/activities/expected";
import { useAppLocale } from "@zoonk/learn/locale";
import { NumericAnswerField } from "@zoonk/learn/numeric-answer-field";
import { cn } from "@zoonk/ui/lib/utils";
import {
  exactFractionDigitsFor,
  formatLocalizedNumber,
  parseLocalizedNumber,
} from "@zoonk/utils/localized-number";
import { getUnitPosition } from "@zoonk/utils/math-answer";
import { countDecimalPlaces } from "@zoonk/utils/rounded-answer";
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
import { CanvasKeysContext, CanvasQuestionContext } from "./_utils/canvas-question";
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
  maximumFractionDigits,
  onAnswerChange,
  phase,
  places,
}: Pick<ActivityStepProps, "answer" | "content" | "isCorrect" | "onAnswerChange" | "phase"> & {
  className?: string;
  maximumFractionDigits?: number;
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
    const value = numericValue(answer) ?? null;

    const result = phase === "checked" ? numericResult(isCorrect) : null;

    return (
      <div className={cn("flex flex-col gap-3", className)} data-slot="activity-numeric-check">
        <ActivityCheckQuestion id={questionId}>{check.question}</ActivityCheckQuestion>
        <NumericAnswerField
          entry={places === null ? null : { kind: "decimals", places }}
          labelledBy={questionId}
          locked={phase === "checked"}
          maximumFractionDigits={maximumFractionDigits}
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

/** Stops the step's question from answering number keys the canvas is using, its key badges hidden in place. */
function QuestionKeys({ children, paused }: { children: React.ReactNode; paused: boolean }) {
  const interactionState = usePlayerInteractionState();

  return (
    <PlayerInteractionContext value={paused ? "paused" : interactionState}>
      <div className={cn("contents", paused && "**:data-[slot=kbd]:invisible")}>{children}</div>
    </PlayerInteractionContext>
  );
}

function numericValue(answer: ActivityStepProps["answer"]): number | undefined {
  return answer?.kind === "numeric" ? answer.value : undefined;
}

function displayedAnswer(
  answer: ActivityStepProps["answer"],
  maximumFractionDigits: number | undefined,
): ActivityStepProps["answer"] {
  if (answer?.kind !== "numeric") {
    return answer;
  }

  const locale = "en";

  const text = formatLocalizedNumber({
    grouping: false,
    locale,
    maximumFractionDigits,
    value: answer.value,
  });

  return { ...answer, value: parseLocalizedNumber({ locale, text }) ?? answer.value };
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
  const display = getActivityRoundedAnswer(content);
  const places = display?.places ?? null;
  const expected = phase === "checked" ? getActivityExpected(content) : null;
  const badgeKind = badge(content);
  const [canvasAsks, setCanvasAsks] = useState(false);
  const [canvasHasKeys, setCanvasHasKeys] = useState(false);
  const [typedValue, setTypedValue] = useState<number>();
  const value = numericValue(answer);
  const { check } = content;
  const typedPlaces = typedValue === value ? countDecimalPlaces(typedValue ?? 0) : 0;

  function numericDigits(numericCheck: Extract<typeof check, { kind: "numeric" }>) {
    if (phase === "checked" && value !== undefined) {
      return getCheckedAnswerDigits({ content, isCorrect: isCorrect !== false, value });
    }

    return Math.max(
      exactFractionDigitsFor({
        expected: numericCheck.answer,
        tolerance: numericCheck.tolerance,
        value,
      }),
      places ?? 0,
      typedPlaces,
    );
  }

  const maximumFractionDigits = check.kind === "numeric" ? numericDigits(check) : undefined;

  const shownAnswer = phase === "checked" ? displayedAnswer(answer, maximumFractionDigits) : answer;

  // The formula chart uses the submitted number to format its label, just like feedback.
  const canvasAnswer = content.template === "formulaModel" ? shownAnswer : answer;

  function changeCanvasAnswer(next: ActivityStepProps["answer"]) {
    setTypedValue(undefined);
    onAnswerChange(next);
  }

  function changeFieldAnswer(next: ActivityStepProps["answer"]) {
    setTypedValue(numericValue(next));
    onAnswerChange(next);
  }

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
            <CanvasKeysContext value={setCanvasHasKeys}>
              <BrowserCanvas
                answer={canvasAnswer}
                content={content}
                expected={expected}
                labelId={labelId}
                onAnswerChange={changeCanvasAnswer}
                phase={phase}
              />
            </CanvasKeysContext>
          </CanvasQuestionContext>
        </PlayerInteractionContext>

        <ActivityDataNote content={content} />
      </fieldset>

      {!canvasAsks && !answersOnCanvas && (
        <QuestionKeys paused={canvasHasKeys}>
          <ActivityCheckArea
            isCorrect={isCorrect}
            answer={answer}
            className="pt-2"
            content={content}
            maximumFractionDigits={maximumFractionDigits}
            onAnswerChange={changeFieldAnswer}
            phase={phase}
            places={places}
          />
        </QuestionKeys>
      )}

      {phase === "checked" && isCorrect !== null && (
        <ActivityFeedback
          answer={shownAnswer}
          content={content}
          display={display}
          isCorrect={isCorrect}
          showsNumbers={!answersOnCanvas}
        />
      )}
    </InteractiveStepLayout>
  );
}
