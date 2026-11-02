"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { ActivityExplore } from "../../activities/activity-explore";
import { PlayerReadScene } from "../../components/player-read-scene";
import {
  LessonStepPicture,
  useHasStepPicture,
  useIsExploredPictureLost,
} from "../_components/lesson-pictures";
import { LessonRichText } from "../_components/lesson-rich-text";
import { LessonBody } from "../_components/lesson-step-text";
import { StrugglePauseOffer } from "../controls/ask-buddy-offer";
import { ExampleLine } from "./example-line";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

export function ExplanationStepView({ step }: LessonStepViewProps<StepOf<"explanation">>) {
  const { content } = step;
  const hasPicture = useHasStepPicture(step);
  const exploredPictureLost = useIsExploredPictureLost(step);
  const ideaId = useId();

  return (
    <PlayerReadScene className={cn("gap-5 sm:gap-6", hasPicture && "max-sm:pt-0")}>
      <div className="flex w-full flex-col gap-2 sm:gap-3" id={ideaId}>
        {content.title && (
          <h2 className="text-foreground text-[0.9375rem] leading-snug font-semibold">
            <LessonRichText text={content.title} />
          </h2>
        )}
        <LessonBody>{content.text}</LessonBody>
      </div>

      <LessonStepPicture className="order-first" hero priority step={step} />
      <LessonVisual visual={content.visual} />
      {content.explore && !exploredPictureLost && (
        <ActivityExplore content={content.explore} labelId={ideaId} />
      )}
      <StrugglePauseOffer step={step} />

      {content.exampleLineSlot && <ExampleLine key={step.id} stepId={step.id} />}
    </PlayerReadScene>
  );
}
