"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonStepPicture, useHasStepPicture } from "../_components/lesson-pictures";
import { LessonRichText } from "../_components/lesson-rich-text";
import { LessonBody } from "../_components/lesson-step-text";
import { StrugglePauseOffer } from "../controls/ask-buddy-offer";
import { ExampleLine } from "./example-line";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/**
 * One idea per screen: its picture first, like a story, then the idea, its chart or timeline and
 * a personal example. A learner who stays far past its reading time is offered their buddy's help.
 */
export function ExplanationStepView({ step }: LessonStepViewProps<StepOf<"explanation">>) {
  const { content } = step;
  const hasPicture = useHasStepPicture(step);

  return (
    <PlayerReadScene className={cn("gap-5 sm:gap-6", hasPicture && "max-sm:pt-0")}>
      <LessonStepPicture hero priority step={step} />

      <div className="flex w-full flex-col gap-2 sm:gap-3">
        {content.title && (
          <h2 className="text-muted-foreground text-base font-semibold sm:text-lg">
            <LessonRichText text={content.title} />
          </h2>
        )}
        <LessonBody>{content.text}</LessonBody>
      </div>

      <LessonVisual visual={content.visual} />
      <StrugglePauseOffer step={step} />

      {/* Last on the screen, so the line arriving after the screen shows moves nothing. */}
      {content.exampleLineSlot && <ExampleLine stepId={step.id} />}
    </PlayerReadScene>
  );
}
