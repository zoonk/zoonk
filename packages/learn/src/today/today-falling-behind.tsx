"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { CalendarClockIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { KindTile } from "../_components/kind-tile";
import {
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { SURFACE_CLASS } from "../_components/surface";
import { useFormatDuration } from "../_utils/time-format";
import { useLearnAnalytics } from "../learn-context";
import { LearnLink } from "../learn-link";
import { useAppliedLine } from "../plan/use-change-sentence";
import { useTodayScreen } from "./today-context";

type Change = NonNullable<TodayView["planChange"]>;
type Behind = NonNullable<PlanChangeView["behind"]>;
type Answer = { applied: PlanChangeView } | { kept: true } | { failed: true } | null;

/** "At 45 min a day, your plan now covers 85% of the exam by January 17, down from 100%." */
function useBehindSentence() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDuration = useFormatDuration();
  const { today } = useTodayScreen();

  return (behind: Behind): string => {
    const values = {
      after: format.number(behind.coveredAfter, { style: "percent" }),
      before: format.number(behind.coveredBefore, { style: "percent" }),
      date: today.goal.targetDate
        ? format.dateTime(today.goal.targetDate, { day: "numeric", month: "long", timeZone: "UTC" })
        : "",
      time: formatDuration(behind.currentMinutes),
    };

    return behind.measure === "exam"
      ? t(
          "You're behind: at {time} a day, your plan now covers {after} of the exam by {date}, down from {before}.",
          values,
        )
      : t(
          "You're behind: at {time} a day, your plan now covers {after} of your goal by {date}, down from {before}.",
          values,
        );
  };
}

/**
 * The notice's title: what more time a day does (everything in depth again, or, when no time does,
 * more of it), or plainly that the plan fell behind when no time helps.
 */
function useBehindTitle() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (behind: Behind): string => {
    if (behind.dailyMinutes === null) {
      return t("Your plan fell behind");
    }

    const time = formatDuration(behind.dailyMinutes);

    return behind.fullDepth
      ? t("To study everything in depth again: {time} a day.", { time })
      : t("At {time} a day, more of it in depth.", { time });
  };
}

/**
 * Falling behind put the goal's date at risk: Today says plainly what the plan now covers by the
 * date and lets the learner choose (D1): more time a day (the time that covers it all again),
 * where to focus, or keeping their time with less depth where it counts least. Nothing changes
 * until they tap.
 */
export function FallingBehindNotice({ behind, change }: { behind: Behind; change: Change }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const analytics = useLearnAnalytics();
  const sentence = useBehindSentence();
  const behindTitle = useBehindTitle();
  const appliedLine = useAppliedLine();
  const { actions } = useTodayScreen();
  const notice = useRef<HTMLElement>(null);
  const [answer, setAnswer] = useState<Answer>(null);
  const [isPending, startTransition] = useTransition();

  const choose = (choice: "keep" | "moreTime") =>
    startTransition(async () => {
      const applied =
        choice === "moreTime" && behind.dailyMinutes !== null
          ? await safeAsync(() =>
              actions.changePlan([{ kind: "setDailyMinutes", minutes: behind.dailyMinutes ?? 0 }]),
            )
          : null;

      if (applied && !applied.data) {
        setAnswer({ failed: true });
        return;
      }

      const { data: seen } = await safeAsync(() =>
        actions.decidePlanChange({ changeId: change.id, status: "seen" }),
      );

      if (!applied && !seen) {
        setAnswer({ failed: true });
        return;
      }

      setAnswer(applied?.data ? { applied: applied.data } : { kept: true });
      notice.current?.focus();

      analytics.track({
        name: "Plan Edited",
        properties: { change_kind: `today:behind:${choice}` },
      });
    });

  return (
    <section
      aria-label={t("Plan change")}
      className={cn(
        SURFACE_CLASS,
        "focus-visible:ring-ring/50 flex items-start gap-3 p-4 outline-none focus-visible:ring-[3px]",
      )}
      data-slot="today-plan-change"
      ref={notice}
      tabIndex={-1}
    >
      <NoticeCardLeading>
        <KindTile icon={CalendarClockIcon} kind="lesson" size="sm" />
      </NoticeCardLeading>

      <NoticeCardContent>
        <NoticeCardTitle>{behindTitle(behind)}</NoticeCardTitle>
        <NoticeCardDescription>{sentence(behind)}</NoticeCardDescription>

        {answer && !("failed" in answer) ? (
          <p className="mt-2.5 text-sm font-medium" role="status">
            {"applied" in answer
              ? appliedLine(answer.applied.todaySession)
              : t("Noted. You keep your time, with less depth where it counts least.")}
          </p>
        ) : (
          <NoticeCardActions>
            {behind.dailyMinutes !== null && (
              <Button
                disabled={isPending}
                focusableWhenDisabled
                onClick={() => choose("moreTime")}
                size="sm"
              >
                {t("Study {time} a day", { time: formatDuration(behind.dailyMinutes) })}
              </Button>
            )}

            {behind.canFocus && (
              <LearnLink
                className={buttonVariants({ size: "sm", variant: "ghost" })}
                href={actions.chooseFocusHref}
              >
                {t("Choose where to focus")}
              </LearnLink>
            )}

            <Button
              disabled={isPending}
              focusableWhenDisabled
              onClick={() => choose("keep")}
              size="sm"
              variant="ghost"
            >
              {t("Keep my time")}
            </Button>
          </NoticeCardActions>
        )}

        {answer && "failed" in answer && (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {t("We couldn't save that. Try again.")}
          </p>
        )}
      </NoticeCardContent>
    </section>
  );
}
