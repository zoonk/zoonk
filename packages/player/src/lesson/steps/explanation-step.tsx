"use client";

import { LESSON_BODY_CLASS } from "@zoonk/learn/rich-text";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { SpokenMath } from "@zoonk/learn/rich-text/spoken-math";
import { LessonVisual } from "@zoonk/learn/visual";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { ActivityBadge } from "../../activities/_components/activity-badge";
import { ActivityExplore, exploreBadge } from "../../activities/activity-explore";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonStepPicture, useIsExploredPictureLost } from "../_components/lesson-pictures";
import { LessonRichText } from "../_components/lesson-rich-text";
import { useTermHighlighter } from "../_components/lesson-step-text";
import { CornerIcon, MarkedText, hasExampleFrame } from "../_components/marked-text";
import { ExplainingScreenHelp } from "../controls/ask-buddy-offer";
import { ExampleLine } from "./example-line";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/** A heading is the size of the text it heads, set apart by its weight, never smaller. */
const STEP_HEADING_CLASS =
  "text-foreground mb-2 text-lg leading-snug font-semibold text-pretty sm:mb-3 md:text-xl";

export function ExplanationStepView({ step }: LessonStepViewProps<StepOf<"explanation">>) {
  const { content, marks } = step;
  const cornerIcon = hasExampleFrame({ marks, text: content.text }) ? null : marks?.icon;
  const exploredPictureLost = useIsExploredPictureLost(step);
  const ideaId = useId();
  const spoken = useSpokenText();
  const highlighter = useTermHighlighter();
  const idea = content.title ? `${content.title}\n\n${content.text}` : content.text;
  const explored = content.explore && !exploredPictureLost ? content.explore : null;
  const badge = explored ? exploreBadge(explored) : null;

  return (
    <PlayerReadScene className="gap-5 sm:gap-6">
      <div className="flow-root w-full lg:max-w-xl" data-slot="lesson-text">
        {cornerIcon && <CornerIcon className="-me-2 -mt-1 mb-2" icon={cornerIcon} />}
        {badge && (
          <div className="mb-3 empty:hidden">
            <ActivityBadge kind={badge} over={[content.title ?? "", content.text]} />
          </div>
        )}
        {content.title && (
          <h2 className={STEP_HEADING_CLASS}>
            <SpokenMath>
              <LessonRichText text={content.title} />
            </SpokenMath>
          </h2>
        )}
        <MarkedText
          className={cn(LESSON_BODY_CLASS, highlighter)}
          marks={marks}
          text={content.text}
        />
      </div>

      <LessonStepPicture className="order-first" hero priority step={step} />
      <LessonVisual visual={content.visual} />
      {explored && (
        <>
          <span hidden id={ideaId}>
            {spoken.blocks(idea)}
          </span>
          <ActivityExplore content={explored} labelId={ideaId} />
        </>
      )}
      {content.exampleLineSlot && <ExampleLine key={step.id} stepId={step.id} />}
      <ExplainingScreenHelp step={step} />
    </PlayerReadScene>
  );
}
