"use client";

import { useExtracted } from "next-intl";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonSummaryIdeas } from "../_components/lesson-summary-ideas";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/** The summary card: each idea of the lesson in one sentence, to keep. */
export function SummaryStepView({ step }: LessonStepViewProps<StepOf<"summary">>) {
  const t = useExtracted();
  const { ideas } = step.content;

  return (
    <PlayerReadScene className="gap-5 sm:gap-6">
      <div className="flex flex-col gap-1">
        <h2
          className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl"
          data-slot="lesson-summary-title"
        >
          {t("Summary")}
        </h2>
        <p className="text-muted-foreground text-base">
          {t(
            "{count, plural, one {# idea to take from this lesson} other {# ideas to take from this lesson}}",
            { count: ideas.length },
          )}
        </p>
      </div>

      <LessonSummaryIdeas ideas={ideas.map((idea) => idea.text)} />
    </PlayerReadScene>
  );
}
