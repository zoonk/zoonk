"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { GoalRing } from "../_components/goal-ring";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { WEEK_ROW_CLASS, isMissed } from "../_components/week-row";
import { moveFocusWithArrows } from "../_utils/arrow-focus";
import { useTodayScreen } from "./today-context";
import { ChallengeRow, isSameDay } from "./today-week-challenge";
import { WEEK_DAY_SLOT, WeekDayCell } from "./today-week-day";

const WEEK_TITLE_ID = "today-week-title";

const moveBetweenDays = moveFocusWithArrows(WEEK_DAY_SLOT);

export function TodayWeek({ className }: { className?: string }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const challenge = today.weeklyChallenge;
  const { days } = today.session.week;
  const localDate = days.find((day) => day.isToday)?.date ?? today.session.localDate;

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
      </PageSectionHeader>

      <div className="flex flex-col">
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The arrow keys move between the buttons inside. */}
        <ol className={cn(WEEK_ROW_CLASS, "py-1")} onKeyDown={moveBetweenDays}>
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
        {days.some((day) => isMissed(day, localDate)) && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <GoalRing className="size-3.5" share={0} track="missed" />
            {t("Not studied")}
          </p>
        )}
      </div>
    </PageSection>
  );
}
