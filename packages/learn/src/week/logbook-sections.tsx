"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { ClockIcon, ListChecksIcon, SearchCheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { GoalRing } from "../_components/goal-ring";
import { KindMark, type LearnKind } from "../_components/kind-tile";
import { StatTile, StatTiles } from "../_components/stat-tile";
import { DoneMark } from "../_components/status-mark";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
} from "../_components/step-card";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { useLogbook } from "./logbook-context";
import { TurnaroundChart } from "./turnaround-chart";

const DAYS_PER_WEEK = 7;

function WeekRings() {
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

export function WeekStep({ range }: { range: string }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { learnerName, recap } = useLogbook();
  const goodNews = useGoodNews();

  return (
    <StepCard>
      <WeekRings />
      <StepHeader>
        <StepEyebrow>{t("Weekly summary · {range}", { range })}</StepEyebrow>
        <StepTitle className="wrap-anywhere">
          {learnerName ? t("What a week, {name}!", { name: learnerName }) : t("What a week!")}
        </StepTitle>
        {goodNews && <StepDetail>{goodNews}</StepDetail>}
      </StepHeader>

      <StatTiles>
        <StatTile
          icon={<ClockIcon />}
          label={t("Time")}
          tone="time"
          value={formatDuration(recap.week.minutes)}
        />
        <StatTile icon={<ListChecksIcon />} label={t("Questions")} value={recap.week.questions} />
      </StatTiles>
    </StepCard>
  );
}

export function QuietWeekStep({ range }: { range: string }) {
  const t = useExtracted();
  const { recap } = useLogbook();

  return (
    <StepCard>
      <WeekRings />
      <StepHeader>
        <StepEyebrow>{t("Weekly summary · {range}", { range })}</StepEyebrow>
        <StepTitle>
          {recap.ready ? t("A quiet week") : t("Your first weekly summary comes this Sunday")}
        </StepTitle>
        {recap.ready && <StepDetail>{t("Every week starts fresh.")}</StepDetail>}
      </StepHeader>
    </StepCard>
  );
}

export function TurnaroundStep() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { recap } = useLogbook();
  const turnaround = recap.turnaround;

  if (!turnaround) {
    return null;
  }

  return (
    <StepCard>
      <StepHeader>
        <StepEyebrow>{t("Most improved")}</StepEyebrow>
        <StepTitle>{turnaround.name}</StepTitle>
        <StepDetail className="tabular-nums">
          {t({
            description: '{from} and {to} are shares of right answers, like "40%".',
            message: "{from} → {to} right answers",
            values: { from: formatShare(turnaround.from), to: formatShare(turnaround.to) },
          })}
        </StepDetail>
      </StepHeader>

      <TurnaroundChart turnaround={turnaround} />
    </StepCard>
  );
}

export function hasLearned(recap: ReturnType<typeof useLogbook>["recap"]): boolean {
  const { fixes, newIdeas, reviews } = recap.buddyAte;
  return newIdeas + reviews + fixes + recap.badges.length > 0;
}

function LearnedRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
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

/** Wrapped, since a step row sizes and grays any icon that is its direct child. */
function LearnedKindMark({ kind }: { kind: LearnKind }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      <KindMark kind={kind} />
    </span>
  );
}

export function LearnedStep() {
  const t = useExtracted();
  const { recap } = useLogbook();
  const { fixes, newIdeas, reviews } = recap.buddyAte;
  const badges = recap.badges.length;

  return (
    <StepCard>
      <StepHeader>
        {/* The empty line keeps the title where the other steps' titles are. */}
        <StepEyebrow aria-hidden="true" className="min-h-4" />
        <StepTitle>{t("This week")}</StepTitle>
      </StepHeader>
      <StepRows>
        <LearnedRow
          icon={<LearnedKindMark kind="lesson" />}
          label={t("New topics")}
          value={newIdeas}
        />
        <LearnedRow
          icon={<LearnedKindMark kind="review" />}
          label={t("Reviews done")}
          value={reviews}
        />
        <LearnedRow
          icon={<LearnedKindMark kind="mistakes" />}
          label={t("Mistakes fixed")}
          value={fixes}
        />
        <LearnedRow
          icon={<SearchCheckIcon aria-hidden="true" className="text-muted-foreground size-4" />}
          label={t({
            description: "A badge for catching the Trickster's traps.",
            message: "{count, plural, one {Trap hunter badge} other {Trap hunter badges}}",
            values: { count: badges },
          })}
          value={badges}
        />
      </StepRows>
    </StepCard>
  );
}

export function NextWeekStep({ title }: { title: string }) {
  const t = useExtracted();

  return (
    <StepCard>
      <StepHeader>
        <StepEyebrow>{t("Up next")}</StepEyebrow>
        <StepTitle>{title}</StepTitle>
      </StepHeader>
    </StepCard>
  );
}
