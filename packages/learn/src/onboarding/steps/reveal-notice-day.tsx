"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../../_components/save-error";
import { useSentenceSpace } from "../../_utils/locale";
import { NoSittingWords, useNoticeDayText } from "../../plan/notice-day";
import { usePlanScreen } from "../../plan/plan-context";
import { usePlanChange } from "../../plan/use-plan-change";

export function RevealNoticeDay() {
  const t = useExtracted();
  const noticeDayText = useNoticeDayText();
  const space = useSentenceSpace();
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
            <span>{noticeDayText({ ...noticeDay, document: plan.examDocument })}</span>
            {space}
            <Button busy={isPending} onClick={() => use(noticeDay.date)} variant="link">
              {t("Use this date")}
            </Button>
          </>
        ) : (
          noSitting && <NoSittingWords noSitting={noSitting} onUse={use} pending={isPending} />
        )}
      </p>

      {failed && <ChangeSaveError />}
    </div>
  );
}
