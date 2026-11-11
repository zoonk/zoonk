"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { BigQuantity } from "../_components/big-quantity";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { moveFocusWithArrows } from "../_utils/arrow-focus";
import { useFormatDuration } from "../_utils/time-format";
import { useTodayScreen } from "./today-context";
import { ChallengeRow, isSameDay } from "./today-week-challenge";
import { WEEK_DAY_SLOT, WeekDayCell } from "./today-week-day";

const WEEK_TITLE_ID = "today-week-title";

const moveBetweenDays = moveFocusWithArrows(WEEK_DAY_SLOT);

function WeekTime({ className, size }: { className?: string; size: "headline" | "inline" }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { today } = useTodayScreen();
  const { studiedMinutes: studied, targetMinutes: planned } = today.session.week.time;

  if (planned === 0) {
    return null;
  }

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      <span aria-hidden="true">
        {size === "inline" && "· "}
        {size === "headline" ? (
          <BigQuantity className="text-2xl">{formatDuration(studied)}</BigQuantity>
        ) : (
          formatDuration(studied)
        )}
        <span className="text-muted-foreground text-xs">{` / ${formatDuration(planned)}`}</span>
      </span>
      <span className="sr-only">
        {t("{studied} of {planned} studied this week", {
          planned: formatDuration(planned),
          studied: formatDuration(studied),
        })}
      </span>
    </span>
  );
}

function WeekDetail() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { days } = today.session.week;
  const studyDays = days.filter((day) => day.kind === "study" || day.studied).length;
  const studied = days.filter((day) => day.studied).length;

  if (studyDays === 0) {
    return null;
  }

  return (
    <PageSectionDetail className="flex items-center gap-1.5">
      {t("{done, number} of {total, plural, one {# day} other {# days}}", {
        done: studied,
        total: studyDays,
      })}
      <WeekTime className="sm:hidden" size="inline" />
    </PageSectionDetail>
  );
}

export function TodayWeek({ className }: { className?: string }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const challenge = today.weeklyChallenge;
  const { days } = today.session.week;

  const focusIndex = Math.max(
    0,
    days.findIndex((day) => day.isToday),
  );

  // A challenge in a later week waits for its week.
  const inWeek = days.some((day) => isSameDay(day.date, challenge?.date ?? null));

  return (
    <PageSection aria-labelledby={WEEK_TITLE_ID} className={className} data-slot="today-week">
      <PageSectionHeader>
        <PageSectionTitle id={WEEK_TITLE_ID}>{t("This week")}</PageSectionTitle>
        <WeekDetail />
      </PageSectionHeader>

      <WeekTime className="-mt-1 hidden sm:block" size="headline" />

      <div className="flex flex-col">
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The arrow keys move between the buttons inside. */}
        <ol className="grid grid-cols-7 gap-1 py-1" onKeyDown={moveBetweenDays}>
          {days.map((day, index) => (
            <li key={day.date.toISOString()}>
              <WeekDayCell
                challenge={challenge && isSameDay(day.date, challenge.date) ? challenge : null}
                day={day}
                focusable={index === focusIndex}
              />
            </li>
          ))}
        </ol>

        {challenge?.date && inWeek && <ChallengeRow challenge={challenge} date={challenge.date} />}
      </div>
    </PageSection>
  );
}
