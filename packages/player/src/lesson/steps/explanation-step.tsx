"use client";

import { useExtracted } from "next-intl";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonRichText } from "../_components/lesson-rich-text";
import { LessonStepImage } from "../_components/lesson-step-image";
import { LessonBody } from "../_components/lesson-step-text";
import { DepthControls } from "../controls/depth-controls";
import { useDeeperFirst } from "../controls/use-deeper-first";
import { ExampleLine } from "./example-line";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/**
 * One idea per screen: an optional picture, the idea, a personal example and depth on demand. For
 * learners who asked for a more technical register, the deeper version shows first.
 */
export function ExplanationStepView({ step }: LessonStepViewProps<StepOf<"explanation">>) {
  const t = useExtracted();
  const depth = useDeeperFirst(step);
  const { content } = depth;

  return (
    <PlayerReadScene className="gap-5 sm:gap-6">
      {step.image && <LessonStepImage image={step.image} priority />}

      <div aria-live="polite" className="flex w-full flex-col gap-2 sm:gap-3">
        {depth.isDeeper && (
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t("Deeper version")}
          </p>
        )}
        {content.title && (
          <h2 className="text-muted-foreground text-base font-semibold sm:text-lg">
            <LessonRichText text={content.title} />
          </h2>
        )}
        <LessonBody>{content.text}</LessonBody>
      </div>

      {step.content.exampleLineSlot && <ExampleLine stepId={step.id} />}
      <DepthControls deeperFirst={depth} step={step} />
    </PlayerReadScene>
  );
}
