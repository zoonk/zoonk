"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { ListOrderedIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonStepPicture } from "../_components/lesson-pictures";
import { LessonEyebrow, LessonQuestion } from "../_components/lesson-step-text";
import { ScreenSupport } from "../_components/screen-support";
import { StrugglePauseOffer } from "../controls/ask-buddy-offer";
import { useLessonPlayer } from "../lesson-player-context";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";
import { WorkedExampleContent } from "./worked-example-content";

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

      <WorkedExampleContent
        content={step.content}
        figure={
          <ScreenSupport>
            <LessonStepPicture step={step} />
            <LessonVisual visual={step.content.visual} />
          </ScreenSupport>
        }
        revealed={revealed}
      />
      <StrugglePauseOffer step={step} />
    </PlayerReadScene>
  );
}
