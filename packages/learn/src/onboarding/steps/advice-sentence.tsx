"use client";

import { MAX_DAILY_MINUTES, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { useExtracted } from "next-intl";
import { useFormatGoalDate } from "../../_utils/iso-date";
import { useFormatShare } from "../../_utils/percent";
import { useFormatDuration } from "../../_utils/time-format";
import { type FindStatus, FindTimeLine } from "../../plan/plan-coverage";
import { readTimeToCover, useTimeToCoverTexts } from "../../plan/use-time-to-cover";

/**
 * What Find found for the week shown: the time that covers everything in depth by the goal's date,
 * or, when that's more than anyone keeps up, that it is, with the most time a day and the share it
 * covers; or that no time covers more.
 */
function FoundWords({ found }: { found: PlanTimeToCover }) {
  const t = useExtracted();
  const texts = useTimeToCoverTexts();
  const formatDuration = useFormatDuration();
  const formatShare = useFormatShare();
  const formatGoalDate = useFormatGoalDate();
  const answer = readTimeToCover(found);
  const { targetDate, targetDateNamedMonth } = found;

  if (!targetDate) {
    return null;
  }

  if (answer.kind === "covers") {
    return (
      <p className="text-foreground font-medium">
        {texts.covers({ minutes: answer.minutes, targetDate, targetDateNamedMonth })}
      </p>
    );
  }

  if (answer.kind === "none") {
    return <p>{texts.none(MAX_DAILY_MINUTES)}</p>;
  }

  const values = {
    date: formatGoalDate({ isoDate: targetDate, namedMonth: targetDateNamedMonth }),
    share: formatShare(answer.share),
    time: formatDuration(answer.minutes),
  };

  return (
    <p className="text-foreground font-medium">
      {found.measure === "exam"
        ? t(
            "Studying everything in depth by {date} would take more than {time} a day. We recommend {time} a day: about {share} of the plan's exam topics in depth, what comes up most first.",
            values,
          )
        : t(
            "Studying everything in depth by {date} would take more than {time} a day. We recommend {time} a day: about {share} of your goal in depth, what matters most first.",
            values,
          )}
    </p>
  );
}

/**
 * The line under the time chips. Without a date there's nothing to cover by, so the time can just
 * change later. Otherwise it's one live region (see `FindTimeLine`): while the plan is still being
 * built, it says so, or that it's reading the exam's official documents first (`readingNotice`),
 * then "Find the time that covers everything" takes that place, which plans the goal at each daily
 * time only when the learner asks.
 */
export function AdviceSentence({
  dated,
  find,
  found,
  id,
  onFind,
  planReady,
  readingNotice,
}: {
  dated: boolean;
  find: FindStatus;
  found: PlanTimeToCover | null;
  /** Where the step finds the line, to move focus to it once Find answers. */
  id: string;
  onFind: () => void;
  /** The plan said it's built, or asking for it stopped while its run goes on: Find answers. */
  planReady: boolean;
  readingNotice: boolean;
}) {
  const t = useExtracted();

  if (!dated) {
    return <p>{t("You can change this anytime.")}</p>;
  }

  const building = readingNotice
    ? t("Reading the exam's official documents first…")
    : t("Building your plan…");

  return (
    <FindTimeLine
      answer={found && <FoundWords found={found} />}
      canFind
      id={id}
      onFind={onFind}
      status={find}
      waiting={planReady ? null : building}
    />
  );
}
