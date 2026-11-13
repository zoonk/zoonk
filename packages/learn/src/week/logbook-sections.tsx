"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { MS_PER_DAY } from "@zoonk/utils/date";
import {
  ArrowRightIcon,
  ClockIcon,
  ListChecksIcon,
  SearchCheckIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { Eyebrow } from "../_components/eyebrow";
import { GoalRing } from "../_components/goal-ring";
import { KindMark, type LearnKind } from "../_components/kind-tile";
import { StatTile, StatTiles } from "../_components/stat-tile";
import { DoneMark } from "../_components/status-mark";
import { StepDetail, StepHeader, StepRow, StepRows, StepTitle } from "../_components/step-card";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { useLogbook } from "./logbook-context";

const DAYS_PER_WEEK = 7;

export function WeekRings() {
  const t = useExtracted();
  const format = useFormatter();
  const { recap } = useLogbook();
  const studied = new Set(recap.week.daysStudied.map((day) => day.getTime()));

  return (
    <div
      aria-label={t(
        "{count, plural, =0 {# days studied} one {# day studied} other {# days studied}}",
        { count: studied.size },
      )}
      className="grid w-full max-w-80 grid-cols-7 gap-1"
      role="img"
    >
      {Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
        const day = new Date(recap.weekStart.getTime() + index * MS_PER_DAY);
        const isStudied = studied.has(day.getTime());

        return (
          <span className="flex flex-col items-center gap-1.5" key={day.toISOString()}>
            <GoalRing share={isStudied ? 1 : 0}>{isStudied && <DoneMark />}</GoalRing>
            <span
              className={cn(
                "text-2xs font-mono uppercase",
                isStudied ? "text-foreground" : "text-faint",
              )}
            >
              {format.dateTime(day, { timeZone: "UTC", weekday: "narrow" })}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Only good news is said: a finished phase first, then a gain; a quieter week starts over. */
function useGoodNews(): string | null {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { recap } = useLogbook();
  const { minutes, questions } = recap.comparison;
  const finished = recap.phasesFinished[0];

  if (finished) {
    return t("You finished {name}.", { name: finished.name });
  }

  if (minutes > 0) {
    return t("{time} more than the week before!", { time: formatDuration(minutes) });
  }

  if (questions > 0) {
    return t(
      "{questions, plural, one {# more question than the week before!} other {# more questions than the week before!}}",
      { questions },
    );
  }

  return null;
}

export function WeekHeader({ range }: { range: string }) {
  const t = useExtracted();
  const { learnerName, recap } = useLogbook();
  const goodNews = useGoodNews();
  const studied = recap.ready && recap.week.daysStudied.length > 0;

  return (
    <StepHeader>
      <Eyebrow>{t("Weekly summary · {range}", { range })}</Eyebrow>

      {studied && (
        <StepTitle className="wrap-anywhere">
          {learnerName ? t("What a week, {name}!", { name: learnerName }) : t("What a week!")}
        </StepTitle>
      )}

      {!studied && (
        <StepTitle>
          {recap.ready ? t("A quiet week") : t("Your first weekly summary comes this Sunday")}
        </StepTitle>
      )}

      {studied && goodNews && <StepDetail>{goodNews}</StepDetail>}
      {!studied && recap.ready && <StepDetail>{t("Every week starts fresh.")}</StepDetail>}
    </StepHeader>
  );
}

export function WeekTiles() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { recap } = useLogbook();

  return (
    <StatTiles>
      <StatTile
        icon={<ClockIcon />}
        label={t("Time")}
        tone="time"
        value={formatDuration(recap.week.minutes)}
      />
      <StatTile icon={<ListChecksIcon />} label={t("Questions")} value={recap.week.questions} />
    </StatTiles>
  );
}

function CountRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  const format = useFormatter();

  if (value === 0) {
    return null;
  }

  return (
    <StepRow>
      {icon}
      <span className="min-w-0 flex-1 font-medium">{label}</span>
      <span className="shrink-0 font-mono font-medium tabular-nums">{format.number(value)}</span>
    </StepRow>
  );
}

function NameRow({
  children,
  icon,
  label,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <StepRow>
      {icon}
      <span className="shrink-0 font-medium">{label}</span>
      <span className="text-muted-foreground min-w-0 flex-1 text-end text-pretty">{children}</span>
    </StepRow>
  );
}

/** Wrapped, since a step row sizes and grays any icon that is its direct child. */
function KindRowMark({ kind }: { kind: LearnKind }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      <KindMark kind={kind} />
    </span>
  );
}

/** A row with nothing to say isn't drawn, so a light week is a short list. */
export function WeekRows() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { recap } = useLogbook();
  const { fixes, newIdeas, reviews } = recap.buddyAte;
  const badges = recap.badges.length;
  const { nextFocus, turnaround } = recap;

  return (
    <StepRows>
      <CountRow icon={<KindRowMark kind="lesson" />} label={t("New topics")} value={newIdeas} />
      <CountRow icon={<KindRowMark kind="review" />} label={t("Reviews done")} value={reviews} />
      <CountRow icon={<KindRowMark kind="mistakes" />} label={t("Mistakes fixed")} value={fixes} />
      <CountRow
        icon={<SearchCheckIcon aria-hidden="true" />}
        label={t({
          description: "A badge for catching the Trickster's traps.",
          message: "{count, plural, one {Trap hunter badge} other {Trap hunter badges}}",
          values: { count: badges },
        })}
        value={badges}
      />

      {turnaround && (
        <NameRow icon={<TrendingUpIcon aria-hidden="true" />} label={t("Most improved")}>
          {t({
            description:
              'A topic and how its share of right answers grew in a week: "Fractions · 40% to 85%".',
            message: "{topic} · {from} to {to}",
            values: {
              from: formatShare(turnaround.from),
              to: formatShare(turnaround.to),
              topic: turnaround.name,
            },
          })}
        </NameRow>
      )}

      {nextFocus && (
        <NameRow icon={<ArrowRightIcon aria-hidden="true" />} label={t("Up next")}>
          {nextFocus.title}
        </NameRow>
      )}
    </StepRows>
  );
}
