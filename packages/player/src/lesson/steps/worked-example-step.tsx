"use client";

import { Eyebrow } from "@zoonk/learn/eyebrow";
import { LessonVisual } from "@zoonk/learn/visual";
import { ListOrderedIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonStepPicture } from "../_components/lesson-pictures";
import { ScreenSupport } from "../_components/screen-support";
import { ExplainingScreenHelp } from "../controls/ask-buddy-offer";
import { useLessonPlayer } from "../lesson-player-context";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";
import { WorkedExampleContent } from "./worked-example-content";

export function WorkedExampleStepView({ step }: LessonStepViewProps<StepOf<"workedExample">>) {
  const t = useExtracted();
  const { state } = useLessonPlayer();
  const revealed = state.revealed[step.id] ?? 1;

  return (
    <PlayerReadScene className="gap-5 sm:gap-6">
      <Eyebrow icon={<ListOrderedIcon aria-hidden="true" />}>{t("Worked example")}</Eyebrow>

      <WorkedExampleContent
        content={step.content}
        figure={
          <ScreenSupport>
            <LessonStepPicture step={step} />
            <LessonVisual visual={step.content.visual} />
          </ScreenSupport>
        }
        marks={step.marks}
        revealed={revealed}
      />
      <ExplainingScreenHelp step={step} />
    </PlayerReadScene>
  );
}
