"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { useExtracted } from "next-intl";
import { type FindStatus, FindTimeLine } from "../../plan/plan-coverage";
import { readTimeToCover, useTimeToCoverTexts } from "../../plan/use-time-to-cover";

function FoundWords({ found }: { found: PlanTimeToCover }) {
  const texts = useTimeToCoverTexts();
  const answer = readTimeToCover(found);
  const { targetDate, targetDateNamedMonth } = found;

  if (!targetDate) {
    return null;
  }

  if (answer.kind === "none") {
    return (
      <>
        <p>{texts.none({ targetDate, targetDateNamedMonth })}</p>
        {answer.coreMinutes !== null && <p>{texts.everyTopic(answer.coreMinutes)}</p>}
      </>
    );
  }

  return (
    <p className="text-foreground font-medium">
      {texts.covers({ minutes: answer.minutes, targetDate, targetDateNamedMonth })}
    </p>
  );
}

/**
 * One live region (`FindTimeLine`); Find plans the goal at each daily time only when the learner
 * asks.
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
  id: string;
  onFind: () => void;
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
