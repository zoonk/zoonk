"use client";

import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { Suspense, useId } from "react";
import { InteractiveStepLayout } from "../components/step-layouts";
import { LessonQuestion } from "../lesson/_components/lesson-step-text";
import { ActivityBadge } from "./_components/activity-badge";
import { ActivityCanvasSkeleton } from "./_components/activity-canvas";
import { ActivityChoiceCheck } from "./_components/activity-choice-check";
import { ActivityDataNote } from "./_components/activity-data-note";
import { ActivityFeedback } from "./_components/activity-feedback";
import { ActivityNumericCheck } from "./_components/activity-numeric-check";
import { getActivityExpected } from "./_utils/activity-expected";
import { activityRenderers } from "./activity-registry";
import { type ActivityStepProps } from "./activity-renderer";

/** The check's own answer area: options for `choice`, a number for `numeric`, none otherwise. */
function ActivityCheckArea({
  answer,
  content,
  onAnswerChange,
  phase,
}: Pick<ActivityStepProps, "answer" | "content" | "onAnswerChange" | "phase">) {
  const { check } = content;

  if (check.kind === "choice") {
    return (
      <ActivityChoiceCheck
        answer={answer}
        check={check}
        onAnswerChange={onAnswerChange}
        phase={phase}
      />
    );
  }

  if (check.kind === "numeric") {
    return (
      <ActivityNumericCheck
        answer={answer}
        check={check}
        onAnswerChange={onAnswerChange}
        phase={phase}
      />
    );
  }

  return null;
}

/**
 * An `activity` step: the prompt, the picture of the case when it has one, the template's canvas
 * and the check tied to it. The player
 * reducer owns the answer; the canvas and the check area only report changes. After the check,
 * everything is read-only and shows the correct answer next to the learner's with the why.
 */
export function ActivityStep({
  answer,
  content,
  isCorrect,
  onAnswerChange,
  phase,
  picture,
}: ActivityStepProps) {
  const labelId = useId();
  const isMounted = useIsMounted();
  const { badge, Canvas, checkFirst } = activityRenderers[content.template];
  const expected = phase === "checked" ? getActivityExpected(content) : null;

  const checkArea = (
    <ActivityCheckArea
      answer={answer}
      content={content}
      onAnswerChange={onAnswerChange}
      phase={phase}
    />
  );

  return (
    <InteractiveStepLayout data-slot="activity-step">
      <div className="flex flex-col gap-3">
        <ActivityBadge kind={badge} />
        <LessonQuestion id={labelId}>{content.prompt}</LessonQuestion>
      </div>

      {picture}

      {checkFirst && checkArea}

      <div className="flex flex-col gap-2">
        {/* The canvas appears once the page can respond, so nothing is dragged or tapped in vain. */}
        {isMounted ? (
          <Suspense fallback={<ActivityCanvasSkeleton />}>
            <Canvas
              answer={answer}
              content={content}
              expected={expected}
              labelId={labelId}
              onAnswerChange={onAnswerChange}
              phase={phase}
            />
          </Suspense>
        ) : (
          <ActivityCanvasSkeleton />
        )}

        <ActivityDataNote content={content} />
      </div>

      {!checkFirst && checkArea}

      {phase === "checked" && isCorrect !== null && (
        <ActivityFeedback answer={answer} content={content} isCorrect={isCorrect} />
      )}
    </InteractiveStepLayout>
  );
}
