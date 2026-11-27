"use client";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { KindIcon } from "../_components/kind-tile";
import {
  WEEK_DAY_CLASS,
  WeekDayLetter,
  WeekDayRing,
  getDayShare,
  isMissed,
  useWeekDayStatus,
} from "../_components/week-row";
import { toLabelCase } from "../_utils/label-case";
import { useFormatDuration } from "../_utils/time-format";
import { type StudySession } from "../session/session-types";
import { useTodayScreen } from "./today-context";
import {
  type Challenge,
  getChallengeKind,
  useChallengeDayName,
  useWeekdayLabel,
} from "./today-week-challenge";

type WeekDay = StudySession["week"]["days"][number];

export const WEEK_DAY_SLOT = "today-week-day";

const DAY_BUTTON_CLASS =
  "hit-area relative min-h-11 cursor-pointer rounded-md py-1 outline-none transition-colors hover:bg-muted/70 held-pressed:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** The week marks the current local day even while a lesson carries the previous day's session. */
function useWeekDate(): Date {
  const { today } = useTodayScreen();

  return today.session.week.days.find((day) => day.isToday)?.date ?? today.session.localDate;
}

function ChallengeDot({ challenge, day }: { challenge: Challenge; day: WeekDay }) {
  return (
    <WeekDayRing day={day} localDate={useWeekDate()}>
      {getDayShare(day) === 0 && (
        <KindIcon className="size-3.5" kind={getChallengeKind(challenge)} />
      )}
    </WeekDayRing>
  );
}

function useDayStatus() {
  const { today } = useTodayScreen();
  return useWeekDayStatus({ examGoal: today.goal.kind === "exam", localDate: useWeekDate() });
}

function ChallengeDay({ challenge, day }: { challenge: Challenge; day: WeekDay }) {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();
  const dayName = useChallengeDayName();
  const dayStatus = useDayStatus();
  const localDate = useWeekDate();
  const weekday = weekdayLabel(day.date);
  const status = dayStatus(day);
  const name = dayName(challenge);
  const ahead = day.date > localDate;

  return (
    <>
      <ChallengeDot challenge={challenge} day={day} />
      <WeekDayLetter date={day.date} isToday={day.isToday} />
      <span className="sr-only">
        {ahead
          ? t("{day}: {name}", { day: weekday, name })
          : t("{day}: {name}, {status}", { day: weekday, name, status })}
      </span>
    </>
  );
}

function PlainDay({ day }: { day: WeekDay }) {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();
  const dayStatus = useDayStatus();

  return (
    <>
      <WeekDayRing day={day} localDate={useWeekDate()} />
      <WeekDayLetter date={day.date} isToday={day.isToday} />
      <span className="sr-only">
        {t("{day}: {status}", { day: weekdayLabel(day.date), status: dayStatus(day) })}
      </span>
    </>
  );
}

function useDayTime() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (day: WeekDay): string | undefined => {
    if (day.minutes > 0) {
      return day.goalMinutes > 0
        ? t("{studied} of {planned} studied", {
            planned: formatDuration(day.goalMinutes),
            studied: formatDuration(day.minutes),
          })
        : t("{time} studied", { time: formatDuration(day.minutes) });
    }

    return day.goalMinutes > 0
      ? t("{time} planned", { time: formatDuration(day.goalMinutes) })
      : undefined;
  };
}

/** Only what the time line doesn't already say. */
function useDayNote() {
  const dayStatus = useDayStatus();
  const localDate = useWeekDate();

  return (day: WeekDay): string | undefined => {
    const saidByTime =
      !day.hitGoal &&
      (day.minutes > 0 ||
        (day.goalMinutes > 0 && day.kind === "study" && !isMissed(day, localDate)));

    return saidByTime ? undefined : toLabelCase(dayStatus(day));
  };
}

export function WeekDayCell({
  challenge,
  day,
  focusable,
}: {
  challenge: Challenge | null;
  day: WeekDay;
  focusable: boolean;
}) {
  const weekdayLabel = useWeekdayLabel();
  const dayName = useChallengeDayName();
  const dayTime = useDayTime();
  const dayNote = useDayNote();
  const time = dayTime(day);
  const note = dayNote(day);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(WEEK_DAY_CLASS, DAY_BUTTON_CLASS)}
        data-slot={WEEK_DAY_SLOT}
        tabIndex={focusable ? 0 : -1}
      >
        {challenge ? <ChallengeDay challenge={challenge} day={day} /> : <PlainDay day={day} />}
      </PopoverTrigger>

      <PopoverContent className="w-56 gap-1.5 p-3" side="bottom">
        <PopoverHeader className="gap-0.5">
          <PopoverTitle>{weekdayLabel(day.date)}</PopoverTitle>
          {time && <p className="font-mono text-xs tabular-nums">{time}</p>}
          {note && <PopoverDescription className="text-xs">{note}</PopoverDescription>}
        </PopoverHeader>

        {challenge && (
          <p className="flex items-center gap-1.5 text-xs">
            <KindIcon className="size-3.5" kind={getChallengeKind(challenge)} />
            {toLabelCase(dayName(challenge))}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
