"use client";

import { type PlanDayView, type PlanItemView } from "@zoonk/core/plans/view-contract";
import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { useExtracted } from "next-intl";
import { KindMark, type LearnKind } from "../../_components/kind-tile";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowLeading,
  ListRowTrailing,
} from "../../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../../_components/page";
import { useFormatIsoDate } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";

const ITEM_KINDS: Record<PlanItemView["kind"], LearnKind> = {
  boss: "challenge",
  chapter: "lesson",
  checkpoint: "challenge",
  lesson: "lesson",
  mock: "mock",
  review: "review",
};

const ICONS_SHOWN = 4;

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

function DayKinds({ items }: { items: readonly PlanItemView[] }) {
  const rest = items.length - ICONS_SHOWN;

  return (
    <ListRowTrailing aria-hidden="true" className="row-first-line gap-1 max-sm:hidden">
      {items.slice(0, ICONS_SHOWN).map((item, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- the icons are fixed for this day
        <KindMark className="size-3" key={index} kind={ITEM_KINDS[item.kind]} />
      ))}
      {rest > 0 && <span className="text-faint">{`+${rest}`}</span>}
    </ListRowTrailing>
  );
}

/**
 * The dates never wrap, and each row's column is as wide as the longest, so the names line up. The
 * date and the kinds sit on the first name's line, so the names start under the row's top room even
 * when a day has one line, rather than centered in it. Names sit further apart than a name's own
 * lines, so a title that wraps reads as one lesson.
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
  const teaching = day.items.filter((item) => isTeaching(item));
  const names = (teaching.length > 0 ? teaching : day.items).map((item) => itemTitle(item));

  return (
    <ListRow data-slot="week-day">
      <ListRowLeading
        className="text-muted-foreground font-mono text-xs whitespace-nowrap tabular-nums"
        data-slot="week-day-date"
        firstLine
        style={{ minWidth: `${dateWidth}ch` }}
      >
        {date}
      </ListRowLeading>

      <ListRowContent className="justify-start gap-1.5">
        {day.items.length === 0 ? (
          <span className="text-muted-foreground text-sm" data-slot="week-day-item">
            {t("Rest day")}
          </span>
        ) : (
          names.map((name, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- two lessons can share a title
            <span className="text-sm text-pretty" data-slot="week-day-item" key={index}>
              {name}
            </span>
          ))
        )}
      </ListRowContent>

      {day.items.length > 0 && <DayKinds items={day.items} />}
    </ListRow>
  );
}

/** The six days after today, composed with Today by core so each lesson shows once. */
export function RevealWeek({ reveal }: { reveal: PlanRevealDays | null }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();
  const ahead = reveal?.nextDays ?? [];
  const dates = ahead.map((day) => formatDate(day.date, "row", { weekday: true }));
  const dateWidth = Math.max(0, ...dates.map((date) => date.length));

  if (!reveal || !ahead.some((day) => day.items.length > 0)) {
    return null;
  }

  return (
    <PageSection aria-labelledby="reveal-week">
      <PageSectionHeader>
        <PageSectionTitle id="reveal-week">{t("Your first week")}</PageSectionTitle>
        <PageSectionDetail>
          {`${t("{days, plural, one {# study day} other {# study days}}", { days: reveal.week.days })} · ${formatDuration(reveal.week.minutes)}`}
        </PageSectionDetail>
      </PageSectionHeader>

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
    </PageSection>
  );
}
