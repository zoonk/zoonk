"use client";

import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { DoneMark } from "../_components/status-mark";
import { useFormatDuration } from "../_utils/time-format";
import { DayMeter, type DaySegmentState } from "../today/day-segments";
import { getBlockKind } from "./block-kind";
import { type SessionQueueRow } from "./session-queue-rows";
import { type StudyMomentView } from "./session-types";

const PERCENT = 100;

const SEGMENT_BY_STATE: Record<SessionQueueRow["state"], DaySegmentState> = {
  ahead: "ahead",
  done: "done",
  next: "current",
};

function leadNumber(chunks: React.ReactNode) {
  return <span className="font-semibold tabular-nums">{chunks}</span>;
}

function catchUpGain(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium">{chunks}</span>;
}

function TodayLead({ moment }: { moment: StudyMomentView }) {
  const t = useExtracted();
  const { completed, total } = moment.sessionBar;
  const { lead } = moment.dayProgress;

  if (lead === "left") {
    return t.rich({
      description:
        "Counts the blocks of today's study session (lessons, reviews, practice), so it names no noun such as lessons.",
      message:
        "{left, plural, =0 {<number>#</number> left today} one {<number>#</number> left today} other {<number>#</number> left today}}",
      values: { left: total - completed, number: leadNumber },
    });
  }

  if (lead === "open") {
    return t.rich({
      description:
        "Counts the blocks of today's study session (lessons, reviews, practice), so it names no noun such as lessons.",
      message:
        "{completed, plural, =0 {<number>#</number> done today} one {<number>#</number> done today} other {<number>#</number> done today}}",
      values: { completed, number: leadNumber },
    });
  }

  return t.rich({
    description:
      "Counts the blocks of today's study session (lessons, reviews, practice), so it names no noun such as lessons.",
    message:
      "{completed, plural, =0 {<number>#</number> of {total} done today} one {<number>#</number> of {total} done today} other {<number>#</number> of {total} done today}}",
    values: { completed, number: leadNumber, total: String(total) },
  });
}

function useTodayCaption(moment: StudyMomentView): string | null {
  const t = useExtracted();
  const { lead, lessonsComing } = moment.dayProgress;
  const { completed, total } = moment.sessionBar;

  if (lead === "left") {
    return t(
      "{completed, plural, =0 {# of {total} done} one {# of {total} done} other {# of {total} done}}",
      { completed, total: String(total) },
    );
  }

  return lead === "open" && lessonsComing ? t("More as you go") : null;
}

function DeferredLessons({ moment }: { moment: StudyMomentView }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  if (moment.deferredLessonsCount === 0) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-xs text-pretty">
      {t(
        "{count, plural, one {# lesson moved} other {# lessons moved}} to another day to fit your {time} today.",
        { count: moment.deferredLessonsCount, time: formatDuration(moment.minutes.dailyGoal) },
      )}
    </p>
  );
}

/**
 * Only the part this block just finished fills, on Brain Power's beat; everything else is drawn
 * where it stands.
 */
export function MomentToday({
  moment,
  rows,
}: {
  moment: StudyMomentView;
  rows: readonly SessionQueueRow[];
}) {
  const format = useFormatter();
  const celebrate = useCelebration();
  const { lead, percent } = moment.dayProgress;
  const caption = useTodayCaption(moment);

  return (
    <section className="flex w-full flex-col gap-2" data-slot="moment-today">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          <TodayLead moment={moment} />
        </span>
        {percent !== null && (
          <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
            {format.number(percent / PERCENT, { maximumFractionDigits: 0, style: "percent" })}
          </span>
        )}
      </p>

      {rows.length + Number(lead === "open") > 1 && (
        <DayMeter
          fillingId={celebrate ? moment.blockId : null}
          held={lead === "open"}
          parts={rows.map((row) => ({
            id: "id" in row.block ? row.block.id : row.block.position,
            kind: getBlockKind(row.block),
            state: SEGMENT_BY_STATE[row.state],
          }))}
        />
      )}

      {caption && (
        <p
          className={cn(
            "text-muted-foreground text-xs",
            lead === "left" && "font-mono tabular-nums",
          )}
        >
          {caption}
        </p>
      )}

      <DeferredLessons moment={moment} />
    </section>
  );
}

export function MomentCatchUp({ catchUp }: { catchUp: StudyMomentView["dayProgress"]["catchUp"] }) {
  const t = useExtracted();

  if (!catchUp) {
    return null;
  }

  if (catchUp.lessonsLeft === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm" data-slot="moment-catch-up">
        <DoneMark />
        {t("No lessons left to catch up.")}
      </p>
    );
  }

  if (catchUp.doneToday === 0) {
    return (
      <p className="text-muted-foreground text-sm" data-slot="moment-catch-up">
        {t("{lessons, plural, one {# lesson to catch up} other {# lessons to catch up}}", {
          lessons: catchUp.lessonsLeft,
        })}
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm" data-slot="moment-catch-up">
      {t.rich(
        "{done, plural, one {<gain># caught up today</gain>} other {<gain># caught up today</gain>}} · {left, plural, one {# to go} other {# to go}}",
        { done: catchUp.doneToday, gain: catchUpGain, left: catchUp.lessonsLeft },
      )}
    </p>
  );
}
