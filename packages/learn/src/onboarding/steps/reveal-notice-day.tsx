"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { useFormatIsoDate } from "../../_utils/iso-date";
import { useNoticeDayText } from "../../plan/notice-day";
import { usePlanScreen } from "../../plan/plan-context";
import { PlanFailedMessage } from "../../plan/plan-failed-message";
import { usePlanChange } from "../../plan/use-plan-change";

/**
 * The notice's exam day when the plan counts down to another (the month the learner said, or a
 * date of their own), as one line under the plan's facts with one tap to take it ("The exam notice
 * says November 8, 2026. · Use this date"), or, for an exam held several times a year with no
 * sitting in their month, the closest ones, each one tap away. The plan keeps theirs until they
 * pick one.
 */
export function RevealNoticeDay() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const noticeDayText = useNoticeDayText();
  const { plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const { noSitting, noticeDay } = plan.schedule;

  if (plan.notice === "usual" || (!noticeDay && !noSitting)) {
    return null;
  }

  const use = (date: string) => void change([{ kind: "setTargetDate", targetDate: date }]);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-sm text-pretty" data-slot="notice-day">
        {noticeDay ? (
          <>
            <span>{noticeDayText({ ...noticeDay, document: plan.examDocument })}</span>{" "}
            <Button disabled={isPending} onClick={() => use(noticeDay.date)} variant="link">
              {t("Use this date")}
            </Button>
          </>
        ) : (
          noSitting && (
            <>
              <span>
                {t("No exam date in {month}", { month: formatDate(noSitting.month, "month") })}
              </span>
              {noSitting.closest.map((date) => (
                <Fragment key={date}>
                  <span aria-hidden="true">{" · "}</span>
                  <Button disabled={isPending} onClick={() => use(date)} variant="link">
                    {t("Use {date}", { date: formatDate(date, "long") })}
                  </Button>
                </Fragment>
              ))}
            </>
          )
        )}
      </p>

      {failed && <PlanFailedMessage />}
    </div>
  );
}
