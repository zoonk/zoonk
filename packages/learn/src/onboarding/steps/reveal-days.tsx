"use client";

import { type PlanDayView, type PlanItemView } from "@zoonk/core/plans/view-contract";
import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { KindMark, type LearnKind } from "../../_components/kind-tile";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../../_components/page";
import { isoDateToUtc } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { BlockMark } from "../../session/block-mark";
import { type DayStep } from "../../session/session-types";
import { useBlockTitle } from "../../session/use-block-copy";
import { isFinished, splitTodayQueue } from "../../today/today-queue";
import { useStepLabel } from "../../today/use-row-label";

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

/** Lands on the moment's third beat, after the check and the lesson count. */
function NextTag({ children }: { children: string }) {
  const celebrate = useCelebration();

  return (
    <span
      className={cn("inline-block", celebrate && "animate-settle")}
      style={celebrate ? { animationDelay: `${2 * BEAT_MS}ms` } : undefined}
    >
      <span className="text-success-text font-medium">{children}</span>
      {" ·\u00A0"}
    </span>
  );
}

function TodayRow({
  block,
  line,
  tag,
}: {
  block: DayStep;
  line: string | null;
  tag: string | null;
}) {
  const t = useExtracted();
  const title = useBlockTitle();
  const formatDuration = useFormatDuration();
  const details = [line, formatDuration(block.estimatedMinutes)].filter(Boolean);

  return (
    <ListRow data-highlighted={tag ? "" : undefined}>
      <ListRowLeading>
        <ListRowIcon>
          <BlockMark block={block} />
        </ListRowIcon>
      </ListRowLeading>

      <ListRowContent>
        <ListRowTitle className={cn(isFinished(block) && "text-muted-foreground")}>
          {title(block)}
        </ListRowTitle>

        <ListRowDescription>
          {block.status === "completed" && `${t("Done")} · `}
          {tag && <NextTag>{tag}</NextTag>}
          {details.join(" · ")}
        </ListRowDescription>
      </ListRowContent>
    </ListRow>
  );
}

function useFormatDay() {
  const format = useFormatter();

  return (date: Date) =>
    format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC", weekday: "short" });
}

/** Today's own day, in Today's order: what the learner finished, then where they go on. */
export function RevealToday({ reveal }: { reveal: PlanRevealDays | null }) {
  const t = useExtracted();
  const session = reveal?.today;
  const formatDay = useFormatDay();
  const formatDuration = useFormatDuration();
  const catchUp = new Set(session?.catchUp?.positions);
  const label = useStepLabel((step) => catchUp.has(step.position));
  const next = session?.blocks.find((block) => block.position === session.nextPosition);

  if (!reveal || !session || session.blocks.length === 0) {
    return null;
  }

  const { after, before, done } = next
    ? splitTodayQueue({ blocks: session.blocks, nextPosition: next.position })
    : { after: [], before: [], done: session.blocks };

  const nextTag = done.length > 0 ? t("Up next") : t("Start here");

  return (
    <PageSection aria-labelledby="reveal-today">
      <PageSectionHeader>
        <PageSectionTitle id="reveal-today">{t("Today")}</PageSectionTitle>
        <PageSectionDetail>
          {`${formatDay(session.localDate)} · ${formatDuration(reveal.minutes)}`}
        </PageSectionDetail>
      </PageSectionHeader>

      <ListGroup>
        {[...done, ...before, ...(next ? [next] : []), ...after].map((block) => (
          <TodayRow
            block={block}
            key={block.position}
            line={label(block)}
            tag={block === next ? nextTag : null}
          />
        ))}
      </ListGroup>
    </PageSection>
  );
}

function DayKinds({ items }: { items: readonly PlanItemView[] }) {
  const rest = items.length - ICONS_SHOWN;

  return (
    <ListRowTrailing aria-hidden="true" className="gap-1 self-start pt-3.5">
      {items.slice(0, ICONS_SHOWN).map((item, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- the icons are fixed for this day
        <KindMark className="size-3" key={index} kind={ITEM_KINDS[item.kind]} />
      ))}
      {rest > 0 && <span className="text-faint">{`+${rest}`}</span>}
    </ListRowTrailing>
  );
}

/** The dates never wrap, and each row's column is as wide as the longest, so the names line up. */
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
    <ListRow>
      <ListRowLeading
        className="text-muted-foreground self-start pt-3 font-mono text-xs whitespace-nowrap tabular-nums"
        style={{ minWidth: `${dateWidth}ch` }}
      >
        {date}
      </ListRowLeading>

      <ListRowContent>
        {day.items.length === 0 ? (
          <span className="text-muted-foreground text-sm">{t("Rest day")}</span>
        ) : (
          names.map((name, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- two lessons can share a title
            <span className="text-sm leading-snug text-pretty" key={index}>
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
  const formatDay = useFormatDay();
  const ahead = reveal?.nextDays ?? [];
  const dates = ahead.map((day) => formatDay(isoDateToUtc(day.date)));
  const dateWidth = Math.max(0, ...dates.map((date) => date.length));

  if (!reveal || !ahead.some((day) => day.items.length > 0)) {
    return null;
  }

  return (
    <PageSection aria-labelledby="reveal-week">
      <PageSectionHeader>
        <PageSectionTitle id="reveal-week">{t("Your first week")}</PageSectionTitle>
        <PageSectionDetail>
          {`${t("{days, plural, one {# day} other {# days}}", { days: reveal.week.days })} · ${formatDuration(reveal.week.minutes)}`}
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
