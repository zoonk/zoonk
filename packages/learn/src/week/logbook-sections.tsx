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

/**
 * The week's seven days as Today draws its week: a ring per day, closed in green with a check on a
 * day studied, an empty track otherwise, and the day's letter under it in the mono face.
 */
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
                "font-mono text-[0.6875rem] uppercase",
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

/** "40 min more than the week before!": only good news is compared; a quieter week starts over. */
function useGainLine(): string | null {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { recap } = useLogbook();
  const { minutes, questions } = recap.comparison;

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

/**
 * The week at a glance: its days, a word when it beat the one before, and its time and questions
 * as numbers on their tiles.
 */
export function WeekStep({ range }: { range: string }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { learnerName, recap } = useLogbook();
  const gain = useGainLine();
  const finished = recap.phasesFinished[0];

  return (
    <StepCard>
      <WeekRings />
      <StepHeader>
        <StepEyebrow>
          {finished
            ? t("Phase {phase} · {name} done", {
                name: finished.name,
                phase: String(finished.phase + 1),
              })
            : t("Weekly summary · {range}", { range })}
        </StepEyebrow>
        <StepTitle>
          {learnerName ? t("What a week, {name}!", { name: learnerName }) : t("What a week!")}
        </StepTitle>
        {gain && <StepDetail>{gain}</StepDetail>}
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

/** Before the first finished week, or a week without study: one calm line, no blame. */
export function QuietWeekStep({ range }: { range: string }) {
  const t = useExtracted();
  const { recap } = useLogbook();

  return (
    <StepCard>
      <WeekRings />
      <StepHeader>
        <StepEyebrow>{t("Weekly summary · {range}", { range })}</StepEyebrow>
        <StepTitle>
          {recap.ready ? t("A quiet week") : t("Your first summary comes on Sunday")}
        </StepTitle>
        <StepDetail>
          {recap.ready
            ? t("Every week starts fresh.")
            : t("It shows your week in numbers and the skill that grew the most.")}
        </StepDetail>
      </StepHeader>
    </StepCard>
  );
}

/** Why a skill now reads Solid or Mastered; practice that paid off is said by its numbers. */
function useReason(): string | null {
  const t = useExtracted();
  const { recap } = useLogbook();
  const turnaround = recap.turnaround;

  if (turnaround?.reason === "gold") {
    return t(
      "{skill} is Mastered now: you remembered it on {count, plural, =0 {# different days} one {# different day} other {# different days}}.",
      { count: turnaround.rememberedOn.length, skill: turnaround.name },
    );
  }

  if (turnaround?.reason === "solid") {
    return t("{skill} is Solid now: you kept getting it right on later days.", {
      skill: turnaround.name,
    });
  }

  return null;
}

/** The skill that grew the most: its week day by day, and why it grew. */
export function TurnaroundStep() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { recap } = useLogbook();
  const reason = useReason();
  const turnaround = recap.turnaround;

  if (!turnaround) {
    return null;
  }

  return (
    <StepCard>
      <StepHeader>
        <StepEyebrow>{t("The biggest turnaround")}</StepEyebrow>
        <StepTitle>{turnaround.name}</StepTitle>
        <StepDetail className="tabular-nums">
          {t("{from} → {to} right answers", {
            from: formatShare(turnaround.from),
            to: formatShare(turnaround.to),
          })}
        </StepDetail>
      </StepHeader>

      <TurnaroundChart turnaround={turnaround} />
      {reason && <p className="text-balance">{reason}</p>}
    </StepCard>
  );
}

/** Whether the week added up to anything to list: new ideas, reviews, fixes or badges. */
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

/**
 * A kind's icon as a row's mark here (`KindMark`), so the kinds read apart by shape. Wrapped, since
 * a step row sizes and grays any icon that is its direct child.
 */
function LearnedKindMark({ kind }: { kind: LearnKind }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      <KindMark kind={kind} />
    </span>
  );
}

/** What the week's study added up to: new ideas, reviews and fixes, plus badges earned. */
export function LearnedStep() {
  const t = useExtracted();
  const { recap } = useLogbook();
  const { fixes, newIdeas, reviews } = recap.buddyAte;
  const badges = recap.badges.length;

  return (
    <StepCard>
      <StepTitle>{t("What you learned")}</StepTitle>
      <StepRows>
        <LearnedRow
          icon={<LearnedKindMark kind="lesson" />}
          label={t("{count, plural, one {new idea} other {new ideas}}", { count: newIdeas })}
          value={newIdeas}
        />
        <LearnedRow
          icon={<LearnedKindMark kind="review" />}
          label={t("{count, plural, one {review} other {reviews}}", { count: reviews })}
          value={reviews}
        />
        <LearnedRow
          icon={<LearnedKindMark kind="mistakes" />}
          label={t("{count, plural, one {mistake fixed} other {mistakes fixed}}", { count: fixes })}
          value={fixes}
        />
        <LearnedRow
          icon={<SearchCheckIcon aria-hidden="true" className="text-muted-foreground size-4" />}
          label={t("{count, plural, one {Trap hunter badge} other {Trap hunter badges}}", {
            count: badges,
          })}
          value={badges}
        />
      </StepRows>
    </StepCard>
  );
}

/** What the plan does next week, by name. */
export function NextWeekStep({ title }: { title: string }) {
  const t = useExtracted();

  return (
    <StepCard>
      <StepHeader>
        <StepEyebrow>{t("Next week")}</StepEyebrow>
        <StepTitle>{title}</StepTitle>
      </StepHeader>
    </StepCard>
  );
}
