"use client";

import { type PlanDayView, type PlanItemView } from "@zoonk/core/plans/view-contract";
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
import { DoneMark } from "../../_components/status-mark";
import { isoDateToUtc } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { usePlanScreen } from "../../plan/plan-context";

const ITEM_KINDS: Record<PlanItemView["kind"], LearnKind> = {
  boss: "challenge",
  chapter: "lesson",
  checkpoint: "challenge",
  lesson: "lesson",
  mock: "mock",
  review: "review",
};

const ICONS_SHOWN = 4;

function isFinished(item: PlanItemView): boolean {
  return item.status !== "todo";
}

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

function useChapterTitles(): ReadonlyMap<string, string> {
  const { plan } = usePlanScreen();

  return new Map(
    plan.phases
      .flatMap((phase) => phase.chapters)
      .flatMap((chapter) => (chapter.chapterId ? [[chapter.chapterId, chapter.title]] : [])),
  );
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

function TodayRow({ item, tag }: { item: PlanItemView; tag: string | null }) {
  const t = useExtracted();
  const itemTitle = useItemTitle();
  const chapterTitles = useChapterTitles();
  const formatDuration = useFormatDuration();
  const finished = isFinished(item);
  const chapter = item.chapterId ? chapterTitles.get(item.chapterId) : undefined;
  const details = [chapter, item.minutes ? formatDuration(item.minutes) : null].filter(Boolean);

  return (
    <ListRow data-highlighted={tag ? "" : undefined}>
      <ListRowLeading>
        <ListRowIcon>
          {finished ? <DoneMark /> : <KindMark kind={ITEM_KINDS[item.kind]} />}
        </ListRowIcon>
      </ListRowLeading>

      <ListRowContent>
        <ListRowTitle className={cn(finished && "text-muted-foreground")}>
          {itemTitle(item)}
        </ListRowTitle>

        <ListRowDescription>
          {finished && `${t("Done")} · `}
          {tag && <NextTag>{tag}</NextTag>}
          {details.join(" · ")}
        </ListRowDescription>
      </ListRowContent>
    </ListRow>
  );
}

function useFormatDay() {
  const format = useFormatter();

  return (isoDate: string) =>
    format.dateTime(isoDateToUtc(isoDate), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      weekday: "short",
    });
}

export function RevealToday() {
  const t = useExtracted();
  const formatDay = useFormatDay();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const today = plan.nextDays[0];

  if (!today || today.items.length === 0) {
    return null;
  }

  const next = today.items.find((item) => !isFinished(item));
  const nextTag = today.items.some((item) => isFinished(item)) ? t("Up next") : t("Start here");

  return (
    <PageSection aria-labelledby="reveal-today">
      <PageSectionHeader>
        <PageSectionTitle id="reveal-today">{t("Today")}</PageSectionTitle>
        <PageSectionDetail>
          {`${formatDay(today.date)} · ${formatDuration(today.minutes)}`}
        </PageSectionDetail>
      </PageSectionHeader>

      <ListGroup>
        {today.items.map((item, index) => (
          <TodayRow
            item={item}
            // oxlint-disable-next-line react/no-array-index-key -- in-memory work has no id until the day opens
            key={item.id ?? `${item.kind}-${index}`}
            tag={item === next ? nextTag : null}
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

function WeekDayRow({ day }: { day: PlanDayView }) {
  const t = useExtracted();
  const itemTitle = useItemTitle();
  const formatDay = useFormatDay();
  const teaching = day.items.filter((item) => isTeaching(item));
  const names = (teaching.length > 0 ? teaching : day.items).map((item) => itemTitle(item));

  return (
    <ListRow>
      <ListRowLeading className="text-muted-foreground w-21 self-start pt-3 font-mono text-xs tabular-nums">
        {formatDay(day.date)}
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

/** A day with time but nothing laid out is past the plan's end, so it isn't listed. */
function isListed(day: PlanDayView): boolean {
  return day.items.length > 0 || day.minutes === 0;
}

export function RevealWeek() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const studied = plan.nextDays.filter((day) => day.items.length > 0);
  const ahead = plan.nextDays.slice(1).filter((day) => isListed(day));

  if (!ahead.some((day) => day.items.length > 0)) {
    return null;
  }

  const minutes = studied.reduce((total, day) => total + day.minutes, 0);

  return (
    <PageSection aria-labelledby="reveal-week">
      <PageSectionHeader>
        <PageSectionTitle id="reveal-week">{t("Your first week")}</PageSectionTitle>
        <PageSectionDetail>
          {`${t("{days, plural, one {# day} other {# days}}", { days: studied.length })} · ${formatDuration(minutes)}`}
        </PageSectionDetail>
      </PageSectionHeader>

      <ListGroup>
        {ahead.map((day) => (
          <WeekDayRow day={day} key={day.date} />
        ))}
      </ListGroup>
    </PageSection>
  );
}
