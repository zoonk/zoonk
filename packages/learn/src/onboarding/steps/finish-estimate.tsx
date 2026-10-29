"use client";

import { type PlanTimeAdvice } from "@zoonk/core/plans/time-advice-contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../../_utils/iso-date";
import { type PollStatus } from "../../_utils/use-poll";

function FinishMonth(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium">{chunks}</span>;
}

export function FinishEstimate({
  advice,
  status,
  stopped,
  onRetry,
  studyDays,
}: {
  advice: PlanTimeAdvice | null;
  status: PollStatus;
  stopped: boolean;
  onRetry: () => void;
  studyDays: number;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const failed = status === "failed" || status === "timedOut";
  const loading = studyDays > 0 && !advice && !failed;

  if (stopped && studyDays > 0 && !advice) {
    return null;
  }

  function content() {
    if (studyDays === 0) {
      return t("Choose at least one study day.");
    }

    if (advice?.endDate) {
      return t.rich("You finish around <date>{month}</date>.", {
        date: FinishMonth,
        month: formatDate(advice.endDate, "month"),
      });
    }

    if (advice) {
      return t(
        "We can't estimate a finish date for this schedule. Try more time or more study days.",
      );
    }

    if (failed) {
      return (
        <>
          {t("We couldn't work out when you'd finish.")}{" "}
          <Button onClick={onRetry} variant="link">
            {t("Try again")}
          </Button>
        </>
      );
    }

    return t("Working out when you'd finish…");
  }

  return (
    <p
      aria-busy={loading}
      aria-live="polite"
      className="text-muted-foreground text-sm leading-6 text-pretty"
    >
      {content()}
    </p>
  );
}
