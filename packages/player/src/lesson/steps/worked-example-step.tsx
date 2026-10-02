"use client";

import { ListOrderedIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonStepImage } from "../_components/lesson-step-image";
import { LessonEyebrow, LessonQuestion } from "../_components/lesson-step-text";
import { DepthControls } from "../controls/depth-controls";
import { useLessonPlayer } from "../lesson-player-context";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";
import { WorkedExampleContent } from "./worked-example-content";

/** A worked example revealed step by step with Continue, before the learner tries one alone. */
export function WorkedExampleStepView({ step }: LessonStepViewProps<StepOf<"workedExample">>) {
  const t = useExtracted();
  const { state } = useLessonPlayer();
  const revealed = state.revealed[step.id] ?? 1;

  return (
    <PlayerReadScene className="gap-5 sm:gap-6">
      <div className="flex flex-col gap-3">
        <LessonEyebrow icon={<ListOrderedIcon aria-hidden="true" />}>
          {t("Worked example")}
        </LessonEyebrow>
        {step.content.title && <LessonQuestion>{step.content.title}</LessonQuestion>}
      </div>

      {step.image && <LessonStepImage image={step.image} />}
      <WorkedExampleContent content={step.content} revealed={revealed} />
      <DepthControls step={step} />
    </PlayerReadScene>
  );
}
