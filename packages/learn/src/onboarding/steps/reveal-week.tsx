"use client";

import { type PlanDayView, type PlanItemView } from "@zoonk/core/plans/view-contract";
import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { cn } from "@zoonk/ui/lib/utils";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
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
    <ListRow data-slot="week-day">
      <ListRowLeading
        className="text-muted-foreground font-mono text-xs whitespace-nowrap tabular-nums"
        data-slot="week-day-date"
        style={{ minWidth: `${dateWidth}ch` }}
      >
        {date}
      </ListRowLeading>

      <ListRowContent>
        <span
          className={cn("text-sm", day.items.length === 0 && "text-muted-foreground")}
          data-slot="week-day-item"
        >
          {day.items.length === 0 ? t("Rest day") : facts.join(FACT_SEPARATOR)}
        </span>
      </ListRowContent>
    </ListRow>
  );
}

/** The week the learner is in: Today (`children`), then the six days after it. */
export function RevealWeek({
  children,
  reveal,
}: {
  children: ReactNode;
  reveal: PlanRevealDays | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();
  const ahead = reveal?.nextDays ?? [];
  const dates = ahead.map((day) => formatDate(day.date, "row", { weekday: true }));
  const dateWidth = Math.max(0, ...dates.map((date) => date.length));

  if (!reveal || reveal.week.days === 0) {
    return children;
  }

  return (
    <PageSection aria-labelledby="reveal-week">
      <PageSectionHeader>
        <PageSectionTitle id="reveal-week">{t("Your first week")}</PageSectionTitle>
        <PageSectionDetail>
          {`${t("{days, plural, one {# study day} other {# study days}}", { days: reveal.week.days })} · ${formatDuration(reveal.week.minutes)}`}
        </PageSectionDetail>
      </PageSectionHeader>

      {children}

      {ahead.length > 0 && (
        <ListGroup>
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
