"use client";

import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { useExtracted, useFormatter } from "next-intl";
import { DoneMark } from "../_components/status-mark";
import { DayMeter } from "../today/day-segments";
import { getDayMeterParts } from "./day-meter-parts";
import { type SessionQueueRow } from "./session-queue-rows";
import { type StudyMomentView } from "./session-types";

const PERCENT = 100;

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
  const t = useExtracted();
  const format = useFormatter();
  const celebrate = useCelebration();
  const { catchUp, lead, lessonsComing, percent } = moment.dayProgress;

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

      <DayMeter
        fillingId={celebrate ? moment.blockId : null}
        held={lead === "open"}
        parts={getDayMeterParts({ rows })}
      />

      {/* One caption at most: what's left to catch up, or that today's list is still growing. */}
      {catchUp && <MomentCatchUp catchUp={catchUp} />}
      {!catchUp && lead === "open" && lessonsComing && (
        <p className="text-muted-foreground text-xs">{t("More as you go")}</p>
      )}
    </section>
  );
}

function MomentCatchUp({
  catchUp,
}: {
  catchUp: NonNullable<StudyMomentView["dayProgress"]["catchUp"]>;
}) {
  const t = useExtracted();

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
