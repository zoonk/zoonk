"use client";

import { formatWholeNumber } from "@zoonk/utils/number";
import { ClockIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { CompletionMilestoneMark, CompletionMilestoneTitle } from "./completion-milestone-shell";
import { PlayerSupportingText } from "./player-supporting-text";

type LearningTimeMilestone = Extract<PlayerCompletionMilestone, { kind: "learningTime" }>;

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/**
 * Time milestones use a clock mark so they read as accumulated practice time
 * instead of another accuracy or Energy celebration.
 */
export function LearningTimeMilestoneIndicator() {
  return (
    <CompletionMilestoneMark>
      <span className="bg-score/10 text-score flex size-10 items-center justify-center rounded-full">
        <ClockIcon aria-hidden className="size-5" />
      </span>
    </CompletionMilestoneMark>
  );
}

/**
 * Chooses the clearest title unit for the crossed threshold. Minutes are best
 * below one hour, 24 hours gets the special full-day label, and larger
 * thresholds stay in hours because that is the milestone ladder.
 */
function LearningTimeMilestoneTitle({ seconds }: { seconds: number }) {
  const t = useExtracted();
  const format = useFormatter();
  const minutes = Math.round(seconds / SECONDS_PER_MINUTE);

  if (minutes < MINUTES_PER_HOUR) {
    const formattedMinutes = formatWholeNumber({ format, value: minutes });

    return (
      <CompletionMilestoneTitle>
        {t("{minutes} minutes of learning", { minutes: formattedMinutes })}
      </CompletionMilestoneTitle>
    );
  }

  const hours = Math.round(minutes / MINUTES_PER_HOUR);

  if (hours === HOURS_PER_DAY) {
    return <CompletionMilestoneTitle>{t("1 full day of learning")}</CompletionMilestoneTitle>;
  }

  return (
    <CompletionMilestoneTitle>
      {t("{hours, plural, one {# hour of learning} other {# hours of learning}}", { hours })}
    </CompletionMilestoneTitle>
  );
}

/**
 * Adds the day equivalent once the learner reaches 24 hours, matching the
 * progress-page idea that long learning time is easier to feel in full days.
 */
function LearningTimeMilestoneDescription({ seconds }: { seconds: number }) {
  const t = useExtracted();
  const hours = Math.round(seconds / SECONDS_PER_MINUTE / MINUTES_PER_HOUR);

  if (hours < HOURS_PER_DAY) {
    return (
      <PlayerSupportingText>
        {t("You can learn a lot by practicing for a few minutes a day.")}
      </PlayerSupportingText>
    );
  }

  if (hours === HOURS_PER_DAY) {
    return (
      <PlayerSupportingText>{t("That's a full day of focused practice.")}</PlayerSupportingText>
    );
  }

  const fullDays = Math.floor(hours / HOURS_PER_DAY);

  return (
    <PlayerSupportingText>
      {t(
        "That's more than {days, plural, one {# full day} other {# full days}} of focused practice.",
        { days: fullDays },
      )}
    </PlayerSupportingText>
  );
}

/**
 * Keeps title and supporting copy together for the learning-time milestone
 * while letting each part choose the most readable unit independently.
 */
export function LearningTimeMilestoneCopy({ milestone }: { milestone: LearningTimeMilestone }) {
  return (
    <>
      <LearningTimeMilestoneTitle seconds={milestone.seconds} />
      <LearningTimeMilestoneDescription seconds={milestone.seconds} />
    </>
  );
}
