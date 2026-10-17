"use client";

import { Spinner } from "@zoonk/ui/components/spinner";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { CalendarClockIcon, ClockIcon, HourglassIcon, MoonIcon, SparklesIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { DoneMark } from "../_components/status-mark";
import { useFormatDuration } from "../_utils/time-format";
import { usePastDateText } from "../plan/plan-status-label";
import { useTodayScreen } from "./today-context";
import { useStudiedToday } from "./today-day-progress";
import { TodayStatusClause, TodayStatusLine, TodayStatusSentence } from "./today-status-line";
import { useDayState, useTodayPastDate } from "./use-today-copy";

/** "Today's session is complete. 45 min": the day's blocks are done, with the time it took. */
function DoneStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const studied = useStudiedToday();

  return (
    <TodayStatusLine className={className} icon={<DoneMark />}>
      <TodayStatusSentence>{t("Today's session is complete.")}</TodayStatusSentence>
      {studied > 0 && <TodayStatusClause mono>{formatDuration(studied)}</TodayStatusClause>}
    </TodayStatusLine>
  );
}

/**
 * A day whose lessons are still being written has no blocks yet: it says so, calmly, and fills in
 * on its own (Today reads itself again meanwhile), instead of claiming the day is done. Once that
 * looks stuck, it says to come back.
 */
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
 * The goal's date came with lessons left (see `useTodayPastDate`): no rest day and no "nothing
 * new", but the lessons the plan keeps and the way on, adjusting it. Lucas's Today said "No study
 * planned today. Enjoy your day off!" the day after his date, with 13 lessons he never studied.
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
 * When the learner's study time is back: "See you tomorrow!" only when tomorrow is a study day,
 * else the day the plan studies next, named (Friday's "tomorrow" was a Saturday off), or the next
 * session when the coming week has none. Counted from the week's today, as the week marks it.
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

/**
 * What the day is when there's nothing to start, in one line under the queue: done, a rest day,
 * the study time used up, nothing new in the plan, the goal's date that came with lessons left, or
 * lessons still being written. A rest day that is a return after a break still says hello, as a
 * study day's lighter session does. Nothing while a block is left to go on with.
 */
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
    case "limit":
      return (
        <TodayStatusLine className={className} icon={<HourglassIcon />}>
          <TodayStatusSentence>{t("That's today's study time.")}</TodayStatusSentence>
          <SeeYouClause />
        </TodayStatusLine>
      );
    case "rest":
      return (
        <TodayStatusLine className={className} icon={<MoonIcon />}>
          <TodayStatusSentence>{t("No study planned today.")}</TodayStatusSentence>
          <TodayStatusClause>
            {today.session.freshStart === "welcomeBack"
              ? t("Welcome back! Today is a rest day in your plan, so enjoy it.")
              : t("Enjoy your day off!")}
          </TodayStatusClause>
        </TodayStatusLine>
      );
    case "ahead":
      return (
        <TodayStatusLine className={className} icon={<SparklesIcon />}>
          <TodayStatusSentence>{t("Nothing new for today.")}</TodayStatusSentence>
          <TodayStatusClause>
            {t("You've done every lesson in your plan, or already know it.")}
          </TodayStatusClause>
        </TodayStatusLine>
      );
    case "underway":
      return null;
    default:
      return null;
  }
}
