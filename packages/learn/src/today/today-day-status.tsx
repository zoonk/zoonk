"use client";

import { Spinner } from "@zoonk/ui/components/spinner";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { CalendarClockIcon, ClockIcon, HourglassIcon, MoonIcon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeLimitLink, STATUS_LINK_CLASS } from "../_components/change-limit-link";
import { DoneMark } from "../_components/status-mark";
import { useFormatter } from "../_utils/formatter";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { usePastDateText } from "../plan/plan-status-label";
import { useTodayScreen } from "./today-context";
import { useStudiedToday } from "./today-day-progress";
import { TodayStatusClause, TodayStatusLine, TodayStatusSentence } from "./today-status-line";
import { useDayState, useTodayPastDate, useUpNextLessons } from "./use-today-copy";

function DoneStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const studied = useStudiedToday();
  const { actions, today } = useTodayScreen();
  const keepLearning = useUpNextLessons().length > 0;
  const restDay = today.session.minutes.dailyGoal === 0;

  return (
    <TodayStatusLine className={className} icon={<DoneMark />}>
      <TodayStatusSentence>
        {restDay ? t("You studied on your day off.") : t("Today's session is complete.")}
      </TodayStatusSentence>
      {studied > 0 && <TodayStatusClause mono>{formatDuration(studied)}</TodayStatusClause>}
      {keepLearning && (
        <>
          {" "}
          <LearnLink className={STATUS_LINK_CLASS} href={actions.summaryHref} prefetch={false}>
            {t("See today's summary")}
          </LearnLink>
        </>
      )}
    </TodayStatusLine>
  );
}

function RestStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const welcomeBack = today.session.freshStart === "welcomeBack";
  const keepLearning = useUpNextLessons().length > 0;

  return (
    <TodayStatusLine className={className} icon={<MoonIcon />}>
      <TodayStatusSentence>{t("No study planned today.")}</TodayStatusSentence>
      <TodayStatusClause>
        {keepLearning &&
          welcomeBack &&
          t("Welcome back! Your next lessons are here if you'd like to study.")}
        {keepLearning && !welcomeBack && t("Your next lessons are here if you'd like to study.")}
        {!keepLearning &&
          welcomeBack &&
          t("Welcome back! Today is a rest day in your plan, so enjoy it.")}
        {!keepLearning && !welcomeBack && t("Enjoy your day off!")}
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
      <TodayStatusClause>{t("They show up here on their own.")}</TodayStatusClause>
    </TodayStatusLine>
  );
}

/**
 * Never a rest day or "nothing new" past the goal's date: the lessons left are still the plan's.
 */
function PastDateStatus({ className, lessons }: { className?: string; lessons: number }) {
  const t = useExtracted();
  const pastDateText = usePastDateText();
  const { today } = useTodayScreen();

  return (
    <TodayStatusLine className={className} icon={<CalendarClockIcon />}>
      <TodayStatusSentence>
        {pastDateText({ isExam: today.goal.kind === "exam", lessons }).sentence}
      </TodayStatusSentence>
      <TodayStatusClause>{t("Adjust your plan to keep going.")}</TodayStatusClause>
    </TodayStatusLine>
  );
}

/**
 * "See you tomorrow!" only when tomorrow is a study day; else the plan's next day by name, or the
 * next session.
 */
function SeeYouClause() {
  const t = useExtracted();
  const format = useFormatter();
  const { today } = useTodayScreen();
  const { days, nextStudyDate } = today.session.week;
  const weekDate = days.find((day) => day.isToday)?.date ?? today.session.localDate;

  if (!nextStudyDate) {
    return <TodayStatusClause>{t("See you in your next session!")}</TodayStatusClause>;
  }

  if (nextStudyDate.getTime() - weekDate.getTime() === MS_PER_DAY) {
    return <TodayStatusClause>{t("See you tomorrow!")}</TodayStatusClause>;
  }

  return (
    <TodayStatusClause>
      {t("See you {day}!", {
        day: format.dateTime(nextStudyDate, { timeZone: "UTC", weekday: "long" }),
      })}
    </TodayStatusClause>
  );
}

function LimitStatus({ className, reached }: { className?: string; reached: boolean }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { actions, today } = useTodayScreen();
  const limitTime = formatDuration(today.session.dailyLimit?.limitMinutes ?? 0);

  return (
    <TodayStatusLine className={className} icon={<HourglassIcon />}>
      <TodayStatusSentence>
        {reached
          ? t({
              description: "The daily time limit is a setting that stops study for the day.",
              message: "You've reached your daily time limit of {time}.",
              values: { time: limitTime },
            })
          : t({
              description:
                "The daily time limit is a setting that stops study for the day. It's shorter than the plan's time for today.",
              message: "Today stops at your daily time limit of {time}.",
              values: { time: limitTime },
            })}
      </TodayStatusSentence>
      {reached && <SeeYouClause />} <ChangeLimitLink href={actions.dailyLimitHref} />
    </TodayStatusLine>
  );
}

export function TodayDayStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const state = useDayState();
  const pastDate = useTodayPastDate();
  const { today } = useTodayScreen();
  const { dailyLimit, minutes } = today.session;
  const limit = dailyLimit?.limitMinutes ?? null;
  const capped = limit !== null && limit < minutes.dailyGoal;
  const cutShort = dailyLimit?.reached === true && minutes.planned < minutes.dailyGoal;

  if (pastDate) {
    return <PastDateStatus className={className} lessons={pastDate.lessons} />;
  }

  switch (state) {
    case "done":
      return cutShort ? (
        <LimitStatus className={className} reached />
      ) : (
        <DoneStatus className={className} />
      );
    case "waiting":
      return <WaitingStatus className={className} />;
    case "prepare":
      return (
        <TodayStatusLine className={className} icon={<ClockIcon />}>
          <TodayStatusSentence>{t("Today's lessons aren't written yet.")}</TodayStatusSentence>
        </TodayStatusLine>
      );
    case "limit":
      return <LimitStatus className={className} reached />;
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
          <TodayStatusSentence>{t("Nothing new for today.")}</TodayStatusSentence>
          <TodayStatusClause>
            {t("You've done every lesson in your plan, or already know it.")}
          </TodayStatusClause>
        </TodayStatusLine>
      );
    case "underway":
      return capped ? <LimitStatus className={className} reached={false} /> : null;
    default:
      return null;
  }
}
