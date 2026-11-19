"use client";

import { type PlanDayView, type PlanItemView } from "@zoonk/core/plans/view-contract";
import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { cn } from "@zoonk/ui/lib/utils";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { useExtracted } from "next-intl";
import { type ReactNode, useId } from "react";
import { ListGroup, ListRow, ListRowContent, ListRowLeading } from "../../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../../_components/page";
import { useFormatIsoDate } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";

function isTeaching(item: PlanItemView): boolean {
  return item.kind === "lesson" || item.kind === "chapter";
}

function useItemTitle() {
  const t = useExtracted();

  return (item: PlanItemView): string => {
    if (item.kind === "review") {
      return t("Review");
    }

    if (item.kind === "mock") {
      return t("Mock exam");
    }

    if (item.kind === "checkpoint" || item.kind === "boss") {
      return t("Challenge");
    }

    return item.title || t("More lessons");
  };
}

function WeekRow({
  date,
  dateWidth,
  muted = false,
  text,
}: {
  date: string;
  dateWidth: number;
  muted?: boolean;
  text: string;
}) {
  return (
    <ListRow data-slot="week-day">
      <ListRowLeading
        className="text-muted-foreground justify-start font-mono text-xs whitespace-nowrap tabular-nums"
        data-slot="week-day-date"
        style={{ minWidth: `${dateWidth}ch` }}
      >
        {date}
      </ListRowLeading>

      <ListRowContent>
        <span className={cn("text-sm", muted && "text-muted-foreground")} data-slot="week-day-item">
          {text}
        </span>
      </ListRowContent>
    </ListRow>
  );
}

/**
 * One line per day: how many lessons, anything else it holds (a review, a mock exam) and how long.
 * The names wait for the Plan, so the week stays a glance. The dates never wrap, and each row's
 * column is as wide as the longest, so the lines start together.
 */
function WeekDayRow({
  date,
  day,
  dateWidth,
}: {
  date: string;
  dateWidth: number;
  day: PlanDayView;
}) {
  const t = useExtracted();
  const itemTitle = useItemTitle();
  const formatDuration = useFormatDuration();
  const lessons = day.items.reduce((total, item) => total + item.lessons, 0);

  const others = new Set(
    day.items.filter((item) => !isTeaching(item)).map((item) => itemTitle(item)),
  );

  const facts = [
    lessons > 0 && t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons }),
    ...others,
    day.minutes > 0 && formatDuration(day.minutes),
  ].filter(Boolean);

  return (
    <WeekRow
      date={date}
      dateWidth={dateWidth}
      muted={day.items.length === 0}
      text={day.items.length === 0 ? t("Rest day") : facts.join(FACT_SEPARATOR)}
    />
  );
}

/** Today in one line, for a week whose Today shows its lessons elsewhere. */
function useTodayLine(reveal: PlanRevealDays | null): string | null {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const blocks = reveal?.today.blocks ?? [];
  const lessons = blocks.filter((block) => block.lessonId).length;

  if (!reveal || blocks.length === 0) {
    return null;
  }

  return [
    lessons > 0 && t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons }),
    formatDuration(reveal.minutes),
  ]
    .filter(Boolean)
    .join(FACT_SEPARATOR);
}

/**
 * The week the learner is in: Today (`children`), then the six days after it. Without `children`,
 * Today's lessons show elsewhere, so it's a line like the others.
 */
export function RevealWeek({
  children = null,
  reveal,
}: {
  children?: ReactNode;
  reveal: PlanRevealDays | null;
}) {
  const t = useExtracted();
  const titleId = useId();
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();
  const ahead = reveal?.nextDays ?? [];
  const todayLine = useTodayLine(children ? null : reveal);
  const todayDate = t("Today");
  const dates = ahead.map((day) => formatDate(day.date, "row", { weekday: true }));
  const shown = todayLine ? [todayDate, ...dates] : dates;
  const dateWidth = Math.max(0, ...shown.map((date) => date.length));

  if (!reveal || reveal.week.days === 0) {
    return children;
  }

  return (
    <PageSection aria-labelledby={titleId}>
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("Your first week")}</PageSectionTitle>
        <PageSectionDetail>
          {`${t("{days, plural, one {# study day} other {# study days}}", { days: reveal.week.days })} · ${formatDuration(reveal.week.minutes)}`}
        </PageSectionDetail>
      </PageSectionHeader>

      {children}

      {(ahead.length > 0 || todayLine) && (
        <ListGroup>
          {todayLine && <WeekRow date={todayDate} dateWidth={dateWidth} text={todayLine} />}
          {ahead.map((day, index) => (
            <WeekDayRow
              date={dates[index] ?? day.date}
              dateWidth={dateWidth}
              day={day}
              key={day.date}
            />
          ))}
        </ListGroup>
      )}
    </PageSection>
  );
}
