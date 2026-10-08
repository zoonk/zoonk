"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { MS_PER_DAY } from "@zoonk/utils/date";
import {
  ClockIcon,
  LightbulbIcon,
  ListChecksIcon,
  NotebookPenIcon,
  RotateCcwIcon,
  SearchCheckIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { FactChip, FactChips } from "../_components/fact-chips";
import { KindTile } from "../_components/kind-tile";
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

/** The week's seven days, the ones studied filled in: the week at a glance. */
function WeekDots() {
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
      className="flex gap-1.5"
      role="img"
    >
      {Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
        const day = new Date(recap.weekStart.getTime() + index * MS_PER_DAY);
        const isStudied = studied.has(day.getTime());

        return (
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-full text-xs font-semibold",
              isStudied ? "bg-foreground text-background" : "text-muted-foreground border",
            )}
            key={day.toISOString()}
          >
            {format.dateTime(day, { timeZone: "UTC", weekday: "narrow" })}
          </span>
        );
      })}
    </div>
  );
}

/** "40 min more than the week before!": only good news is compared; a quieter week starts over. */
function useGainLine(): string | null {
  const t = useExtracted();
  const { recap } = useLogbook();
  const { minutes, questions } = recap.comparison;

  if (minutes > 0) {
    return t("{minutes} min more than the week before!", { minutes: String(minutes) });
  }

  if (questions > 0) {
    return t(
      "{questions, plural, one {# more question than the week before!} other {# more questions than the week before!}}",
      { questions },
    );
  }

  return null;
}

/** The week in one line: its days, time and questions, and a word when it beat the one before. */
export function WeekStep({ range }: { range: string }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { learnerName, recap } = useLogbook();
  const gain = useGainLine();
  const finished = recap.phasesFinished[0];

  return (
    <StepCard>
      <WeekDots />
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

      <FactChips className="justify-center">
        <FactChip>
          <ClockIcon aria-hidden="true" />
          {formatDuration(recap.week.minutes)}
        </FactChip>
        <FactChip>
          <ListChecksIcon aria-hidden="true" />
          {t("{count, plural, one {# question} other {# questions}}", {
            count: recap.week.questions,
          })}
        </FactChip>
      </FactChips>
    </StepCard>
  );
}

/** Before the first finished week, or a week without study: one calm line, no blame. */
export function QuietWeekStep({ range }: { range: string }) {
  const t = useExtracted();
  const { recap } = useLogbook();

  return (
    <StepCard>
      <WeekDots />
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
    return t("{skill} is Mastered now: you remembered it on {count} different days.", {
      count: String(turnaround.rememberedOn.length),
      skill: turnaround.name,
    });
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
        <StepDetail>
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
      <span className="shrink-0 font-semibold tabular-nums">{format.number(value)}</span>
    </StepRow>
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
          icon={<LightbulbIcon aria-hidden="true" className="text-muted-foreground" />}
          label={t("{count, plural, one {new idea} other {new ideas}}", { count: newIdeas })}
          value={newIdeas}
        />
        <LearnedRow
          icon={<RotateCcwIcon aria-hidden="true" className="text-muted-foreground" />}
          label={t("{count, plural, one {review} other {reviews}}", { count: reviews })}
          value={reviews}
        />
        <LearnedRow
          icon={<NotebookPenIcon aria-hidden="true" className="text-muted-foreground" />}
          label={t("{count, plural, one {mistake fixed} other {mistakes fixed}}", { count: fixes })}
          value={fixes}
        />
        <LearnedRow
          icon={<SearchCheckIcon aria-hidden="true" className="text-muted-foreground" />}
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
      <KindTile kind="lesson" size="lg" />
      <StepHeader>
        <StepEyebrow>{t("Next week")}</StepEyebrow>
        <StepTitle>{title}</StepTitle>
      </StepHeader>
    </StepCard>
  );
}
