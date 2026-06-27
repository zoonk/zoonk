"use client";

import { EPOCH_YEAR, FIRST_SUNDAY_OFFSET } from "@zoonk/utils/date";
import { formatMetricPercent } from "@zoonk/utils/number";
import { TrophyIcon } from "lucide-react";
import { useExtracted, useFormatter, useLocale } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { CompletionMilestoneMark, CompletionMilestoneTitle } from "./completion-milestone-shell";
import { PlayerSupportingText } from "./player-supporting-text";

type ScoreMilestone = Extract<PlayerCompletionMilestone, { kind: "score" }>;

/**
 * Score milestones use a trophy mark because this screen highlights the
 * learner's strongest weekday for answer accuracy.
 */
export function ScoreMilestoneIndicator() {
  return (
    <CompletionMilestoneMark>
      <span className="bg-score/10 text-score flex size-10 items-center justify-center rounded-full">
        <TrophyIcon aria-hidden className="size-5" />
      </span>
    </CompletionMilestoneMark>
  );
}

/**
 * Converts the stored 0-based weekday into a localized weekday name without
 * relying on the current calendar week.
 */
function getWeekdayName({ dayOfWeek, locale }: { dayOfWeek: number; locale: string }) {
  const referenceDate = new Date(EPOCH_YEAR, 0, FIRST_SUNDAY_OFFSET + dayOfWeek);

  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(referenceDate);
}

/**
 * Names the learner's best weekday and repeats the score-page percentage so
 * the milestone feels connected to the page it links to.
 */
export function ScoreMilestoneCopy({ milestone }: { milestone: ScoreMilestone }) {
  const t = useExtracted();
  const format = useFormatter();
  const locale = useLocale();
  const dayName = getWeekdayName({ dayOfWeek: milestone.dayOfWeek, locale });
  const formattedScore = formatMetricPercent({ format, value: milestone.score });

  return (
    <>
      <CompletionMilestoneTitle>
        {t("{day} is your best day", { day: dayName })}
      </CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t(
          "You usually get {percentage} of answers right on {day}, your highest average of the week.",
          { day: dayName, percentage: formattedScore },
        )}
      </PlayerSupportingText>
    </>
  );
}
