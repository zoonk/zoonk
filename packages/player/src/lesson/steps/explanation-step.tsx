"use client";

import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { SpokenMath } from "@zoonk/learn/rich-text/spoken-math";
import { LessonVisual } from "@zoonk/learn/visual";
import { useId } from "react";
import { ActivityExplore } from "../../activities/activity-explore";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonStepPicture, useIsExploredPictureLost } from "../_components/lesson-pictures";
import { LessonRichText } from "../_components/lesson-rich-text";
import { LESSON_BODY_CLASS } from "../_components/lesson-step-text";
import { CornerIcon, MarkedText, hasExampleFrame } from "../_components/marked-text";
import { ExplainingScreenHelp } from "../controls/ask-buddy-offer";
import { ExampleLine } from "./example-line";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

export function ExplanationStepView({ step }: LessonStepViewProps<StepOf<"explanation">>) {
  const { content, marks } = step;
  const cornerIcon = hasExampleFrame({ marks, text: content.text }) ? null : marks?.icon;
  const exploredPictureLost = useIsExploredPictureLost(step);
  const ideaId = useId();
  const spoken = useSpokenText();
  const idea = content.title ? `${content.title}\n\n${content.text}` : content.text;

  return (
    <PlayerReadScene className="gap-5 sm:gap-6">
      <div className="flow-root w-full lg:max-w-xl" data-slot="lesson-text">
        {cornerIcon && <CornerIcon className="-me-2 -mt-1 mb-2" icon={cornerIcon} />}
        {content.title && (
          <h2 className="text-foreground mb-2 text-[0.9375rem] leading-snug font-semibold sm:mb-3">
            <SpokenMath>
              <LessonRichText text={content.title} />
            </SpokenMath>
          </h2>
        )}
        <MarkedText className={LESSON_BODY_CLASS} marks={marks} text={content.text} />
      </div>

      <LessonStepPicture className="order-first" hero priority step={step} />
      <LessonVisual visual={content.visual} />
      {content.explore && !exploredPictureLost && (
        <>
          <span hidden id={ideaId}>
            {spoken.blocks(idea)}
          </span>
          <ActivityExplore content={content.explore} labelId={ideaId} />
        </>
      )}
      {content.exampleLineSlot && <ExampleLine key={step.id} stepId={step.id} />}
      <ExplainingScreenHelp step={step} />
    </PlayerReadScene>
  );
}
