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
import { ScreenSupport } from "../_components/screen-support";
import { StrugglePauseOffer } from "../controls/ask-buddy-offer";
import { ExampleLine } from "./example-line";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/**
 * One idea per screen: its picture first on a phone, like a story, then the idea, its chart,
 * timeline or an activity to explore, and a personal example. From `lg` the picture, chart or
 * activity sits in the aside beside the text, staying in view while a long text scrolls. A learner
 * who stays far past its reading time is offered their buddy's help.
 */
export function ExplanationStepView({ step }: LessonStepViewProps<StepOf<"explanation">>) {
  const { content } = step;
  const hasPicture = useHasStepPicture(step);
  const exploredPictureLost = useIsExploredPictureLost(step);
  const ideaId = useId();

  // The idea comes first for screen readers and in the main column from `lg`; a phone still leads
  // with the picture, like a story.
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

      <ScreenSupport className="max-lg:contents" step={step}>
        <LessonStepPicture className="max-lg:order-first" hero priority step={step} />
        <LessonVisual visual={content.visual} />
        {content.explore && !exploredPictureLost && (
          <ActivityExplore content={content.explore} labelId={ideaId} />
        )}
      </ScreenSupport>
      <StrugglePauseOffer step={step} />

      {/* Last on the screen, so the line arriving after the screen shows moves nothing. */}
      {content.exampleLineSlot && <ExampleLine key={step.id} stepId={step.id} />}
    </PlayerReadScene>
  );
}
