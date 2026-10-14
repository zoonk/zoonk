"use client";

import { type PlanTimeAdvice } from "@zoonk/core/plans/time-advice-contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatGoalDate } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { type PollStatus } from "../../_utils/use-poll";

/**
 * What the question recommends, said once the plan says it: the time that covers everything in
 * depth by the goal's date, or, when that's more than anyone keeps up, that it is, with the most
 * time a day. While the plan is still being built, it says so, or that it's reading the exam's
 * official documents first (`readingNotice`), and when asking for it kept failing or ran too long,
 * it says that too, with a way to ask again.
 */
export function AdviceSentence({
  advice,
  onRetry,
  readingNotice,
  status,
}: {
  advice: PlanTimeAdvice | null;
  onRetry: () => void;
  readingNotice: boolean;
  status: PollStatus;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const formatDuration = useFormatDuration();
  const formatGoalDate = useFormatGoalDate();

  const date = advice?.targetDate
    ? formatGoalDate({ isoDate: advice.targetDate, namedMonth: advice.targetDateNamedMonth })
    : null;

  if (status === "polling" && !advice) {
    return readingNotice
      ? t("Reading the exam's official documents to suggest your daily time…")
      : t("Working out the time your goal needs…");
  }

  if ((status === "failed" || status === "timedOut") && !advice) {
    return (
      <>
        {t("We couldn't work out the time your goal needs.")}{" "}
        <button
          className="text-foreground font-medium underline underline-offset-4"
          onClick={onRetry}
          type="button"
        >
          {t("Try again")}
        </button>
      </>
    );
  }

  if (date && advice?.recommendedMinutes) {
    return t("To study everything in depth by {date}, we recommend {time} a day.", {
      date,
      time: formatDuration(advice.recommendedMinutes),
    });
  }

  if (date && advice?.maximum) {
    const values = {
      date,
      share: format.number(advice.maximum.coveredShare, { style: "percent" }),
      time: formatDuration(advice.maximum.dailyMinutes),
    };

    return advice.measure === "exam"
      ? t(
          "Studying everything in depth by {date} would take more than {time} a day. We recommend {time} a day: about {share} of the plan's exam topics in depth, what comes up most first.",
          values,
        )
      : t(
          "Studying everything in depth by {date} would take more than {time} a day. We recommend {time} a day: about {share} of your goal in depth, what matters most first.",
          values,
        );
  }

  return t("You can change this anytime.");
}
