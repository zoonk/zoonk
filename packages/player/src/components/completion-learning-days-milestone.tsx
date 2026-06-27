"use client";

import { formatWholeNumber } from "@zoonk/utils/number";
import { CalendarDaysIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { CompletionMilestoneMark, CompletionMilestoneTitle } from "./completion-milestone-shell";
import { PlayerSupportingText } from "./player-supporting-text";

type LearningDaysMilestone = Extract<PlayerCompletionMilestone, { kind: "learningDays" }>;

/**
 * Learning-day milestones use a calendar mark because the achievement is about
 * returning on different days, not about one lesson's score.
 */
export function LearningDaysMilestoneIndicator() {
  return (
    <CompletionMilestoneMark>
      <span className="bg-score/10 text-score flex size-10 items-center justify-center rounded-full">
        <CalendarDaysIcon aria-hidden className="size-5" />
      </span>
    </CompletionMilestoneMark>
  );
}

/**
 * Explains the day-count checkpoint in plain habit-building language so the
 * learner understands why different learning days matter.
 */
export function LearningDaysMilestoneCopy({ milestone }: { milestone: LearningDaysMilestone }) {
  const t = useExtracted();
  const format = useFormatter();
  const formattedDays = formatWholeNumber({ format, value: milestone.days });

  return (
    <>
      <CompletionMilestoneTitle>
        {t("{days} learning days", { days: formattedDays })}
      </CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t(
          "You've completed lessons on {days} different days. Practicing often helps you remember what you learn.",
          { days: formattedDays },
        )}
      </PlayerSupportingText>
    </>
  );
}
