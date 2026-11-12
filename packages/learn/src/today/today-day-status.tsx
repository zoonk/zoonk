"use client";

import { Spinner } from "@zoonk/ui/components/spinner";
import { CalendarClockIcon, ClockIcon, MoonIcon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DoneMark } from "../_components/status-mark";
import { LearnLink } from "../learn-link";
import { usePastDateText } from "../plan/plan-status-label";
import { useTodayScreen } from "./today-context";
import { TodayStatusClause, TodayStatusLine, TodayStatusSentence } from "./today-status-line";
import { useDayState, useTodayPastDate, useUpNextLessons } from "./use-today-copy";

function DoneStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const { actions, today } = useTodayScreen();
  const keepLearning = useUpNextLessons().length > 0;
  const restDay = today.session.minutes.dailyGoal === 0;

  return (
    <TodayStatusLine className={className} icon={<DoneMark />}>
      <TodayStatusSentence>
        {restDay ? t("You studied on your day off.") : t("You're done for today.")}
      </TodayStatusSentence>
      {keepLearning && (
        <LearnLink
          className="text-muted-foreground hover:text-foreground font-medium underline underline-offset-2"
          href={actions.summaryHref}
          prefetch={false}
        >
          {t("See today's summary")}
        </LearnLink>
      )}
    </TodayStatusLine>
  );
}

function RestStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const keepLearning = useUpNextLessons().length > 0;

  return (
    <TodayStatusLine className={className} icon={<MoonIcon />}>
      <TodayStatusSentence>{t("No study planned today.")}</TodayStatusSentence>
      <TodayStatusClause>
        {keepLearning
          ? t("Your next lessons are below if you want to study.")
          : t("Enjoy your day off!")}
      </TodayStatusClause>
    </TodayStatusLine>
  );
}

function WaitingStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const { writingStalled } = useTodayScreen();

  if (writingStalled) {
    return (
      <TodayStatusLine className={className} icon={<ClockIcon />}>
        <TodayStatusSentence>
          {t("Today's lessons are taking longer than usual.")}
        </TodayStatusSentence>
        <TodayStatusClause>{t("Come back in a few minutes.")}</TodayStatusClause>
      </TodayStatusLine>
    );
  }

  return (
    <TodayStatusLine className={className} icon={<Spinner />}>
      <TodayStatusSentence>{t("Getting today's lessons ready…")}</TodayStatusSentence>
    </TodayStatusLine>
  );
}

/**
 * Never a rest day or "nothing new" past the goal's date: the lessons left are still the plan's.
 */
function PastDateStatus({ className, lessons }: { className?: string; lessons: number }) {
  const pastDateText = usePastDateText();
  const { today } = useTodayScreen();

  return (
    <TodayStatusLine className={className} icon={<CalendarClockIcon />}>
      <TodayStatusSentence>
        {pastDateText({ isExam: today.goal.kind === "exam", lessons }).sentence}
      </TodayStatusSentence>
    </TodayStatusLine>
  );
}

export function TodayDayStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const state = useDayState();
  const pastDate = useTodayPastDate();
  const { today } = useTodayScreen();

  if (pastDate) {
    return <PastDateStatus className={className} lessons={pastDate.lessons} />;
  }

  switch (state) {
    case "done":
      return <DoneStatus className={className} />;
    case "waiting":
      return <WaitingStatus className={className} />;
    case "prepare":
      return (
        <TodayStatusLine className={className} icon={<ClockIcon />}>
          <TodayStatusSentence>{t("Today's lessons aren't ready yet.")}</TodayStatusSentence>
        </TodayStatusLine>
      );
    case "rest":
      return <RestStatus className={className} />;
    case "ahead":
      // A free exam plan past its first week has its new lessons locked above, so it never claims
      // they're all done.
      if (today.session.examAccess.trialEnded) {
        return (
          <TodayStatusLine className={className} icon={<SparklesIcon />}>
            <TodayStatusSentence>{t("Nothing to review today.")}</TodayStatusSentence>
          </TodayStatusLine>
        );
      }

      return (
        <TodayStatusLine className={className} icon={<SparklesIcon />}>
          <TodayStatusSentence>
            {today.progress?.status?.kind === "finished"
              ? t("You finished your plan.")
              : t("You're all caught up.")}
          </TodayStatusSentence>
        </TodayStatusLine>
      );
    case "underway":
      return null;
    default:
      return null;
  }
}
