"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { cn } from "@zoonk/ui/lib/utils";
import {
  BookOpenIcon,
  BrainIcon,
  RotateCcwIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { PageSectionTitle } from "../../_components/page";
import { StatTile, StatTiles } from "../../_components/stat-tile";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
} from "../../_components/step-card";
import { useFormatGoalProgress, useFormatShare } from "../../_utils/percent";
import { useFormatDuration } from "../../_utils/time-format";
import { useBeltName } from "../../_utils/use-belt-name";
import { useStateLabel } from "../../_utils/use-state-label";
import { type StudySessionSummary } from "../session-types";
import { getRisenSkills } from "./risen-skills";
import { useIsStopped, useSessionSummary } from "./summary-context";

/**
 * "Done in 49 min", in the title's one face: the mono face's wide space read as "Done in 13  min"
 * beside a sans "13". A day stopped early can be shorter than a minute, and "0" would read as none.
 */
function DoneTitle() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { summary } = useSessionSummary();

  if (summary.minutes < 1) {
    return t("Done in under a minute");
  }

  return t("Done in {time}", { time: formatDuration(summary.minutes) });
}

/**
 * Where the goal stands after the session, in its one measure as the Plan says it: an exam's
 * preparation, another goal's progress in its plan's lessons, with how the session moved it. A
 * language goal says its level elsewhere. The move shows only when the number on screen moved:
 * "32% → 32%" says nothing.
 */
function useGoalNumber() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const formatGoalProgress = useFormatGoalProgress();
  const { goalKind, summary } = useSessionSummary();

  if (goalKind === "language") {
    return null;
  }

  const forExam = goalKind === "exam";
  const { after, before } = forExam ? summary.preparation : summary.progress;

  if (after === null) {
    return null;
  }

  const start = before ?? after;
  const format = forExam ? formatShare : formatGoalProgress;
  const shown = { after: format(after), before: format(start) };
  const moved = shown.after !== shown.before;

  return {
    change: moved ? shown : null,
    dropped: moved && after < start,
    label: forExam ? t("Preparation") : t("Progress"),
    value: shown.after,
  };
}

/** "27/31", the total quieter than what was right. */
function RightAnswersValue({ correct, questions }: { correct: number; questions: number }) {
  const format = useFormatter();

  return (
    <>
      {format.number(correct)}
      <span className="text-muted-foreground">{`/${format.number(questions)}`}</span>
    </>
  );
}

/** What was right, as a share, and the net score where a wrong answer cancels a right one. */
function RightAnswersDetail({ summary }: { summary: StudySessionSummary }) {
  const t = useExtracted();
  const formatShare = useFormatShare();

  return (
    <>
      {summary.accuracy !== null && (
        <span className="text-success-text font-mono tabular-nums">
          {formatShare(summary.accuracy)}
        </span>
      )}
      {summary.accuracy !== null && summary.netScore !== null && " · "}
      {summary.netScore !== null && (
        <span className="font-mono tabular-nums">
          {t("net {net}", { net: String(summary.netScore) })}
        </span>
      )}
    </>
  );
}

/** "Back Oct 14 and Oct 16": the days the session's ideas come back for review. */
function ComesBackDetail({ comesBack }: { comesBack: StudySessionSummary["comesBack"] }) {
  const t = useExtracted();
  const format = useFormatter();

  if (comesBack.length === 0) {
    return null;
  }

  const days = comesBack.map(({ date }) =>
    format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC" }),
  );

  return t("Back {days}", { days: format.list(days, { type: "conjunction" }) });
}

/** The belt the session's Brain Power counts toward, with its color as a dot. */
function BeltDetail({ belt }: { belt: NonNullable<StudySessionSummary["belt"]> }) {
  const t = useExtracted();
  const beltName = useBeltName();
  const { color, level } = belt.after;

  return (
    <span className="inline-flex items-center gap-1.5">
      <BeltIndicator color={color} label={beltName(color)} size="sm" />
      {t("{belt}, level {level}", { belt: beltName(color), level: String(level) })}
    </span>
  );
}

/**
 * The day's four numbers, two by two on a phone and sharing one row from `md`: right answers (with
 * the share and, in an exam scored net, the net score), the goal's number and how it moved, what
 * goes to review and when it comes back, and the Brain Power earned toward the belt. Each only
 * when it means something for this goal: a language goal says its level elsewhere. From `lg` the
 * aside celebrates the Brain Power (`EarnedToday`), so its tile leaves the row rather than say it
 * twice. The icons stay quiet; the lines under the numbers carry the color.
 */
function SessionNumbers() {
  const t = useExtracted();
  const format = useFormatter();
  const { summary } = useSessionSummary();
  const goalNumber = useGoalNumber();
  const dropped = goalNumber?.dropped ?? false;

  return (
    <StatTiles className="md:flex md:[&>li]:min-w-0 md:[&>li]:flex-1">
      {summary.questions > 0 && (
        <StatTile
          detail={<RightAnswersDetail summary={summary} />}
          icon={<TargetIcon />}
          label={t("Right")}
          tone="success"
          value={<RightAnswersValue correct={summary.correct} questions={summary.questions} />}
        />
      )}

      {/* A number that went down says so quietly: Maya's "4% → 2%" came in blue beside a rising
          arrow. */}
      {goalNumber && (
        <StatTile
          detail={
            goalNumber.change && (
              <span
                className={cn(
                  "font-mono tabular-nums",
                  dropped ? "text-muted-foreground" : "text-success-text",
                )}
              >
                {`${goalNumber.change.before} → ${goalNumber.change.after}`}
              </span>
            )
          }
          icon={dropped ? <TrendingDownIcon /> : <TrendingUpIcon />}
          label={goalNumber.label}
          tone={dropped ? undefined : "success"}
          value={goalNumber.value}
        />
      )}

      {/* The ideas that come back, beside the days they do: "To review 0 · Back Oct 18" counted the
          mistakes saved instead. */}
      <StatTile
        detail={<ComesBackDetail comesBack={summary.comesBack} />}
        icon={<RotateCcwIcon />}
        label={t("To review")}
        value={format.number(summary.comesBack.reduce((sum, day) => sum + day.skills, 0))}
      />

      <StatTile
        className="lg:hidden"
        detail={summary.belt && <BeltDetail belt={summary.belt} />}
        icon={<BrainIcon />}
        label={t("Brain Power")}
        tone="brain"
        value={t("+{points}", { points: format.number(summary.brainPower) })}
      />
    </StatTiles>
  );
}

/** The state a skill rose to stands out from the one it left. */
function renderNewState(chunks: React.ReactNode) {
  return <span className="text-foreground">{chunks}</span>;
}

/** "Percentages · Learning → Solid": each skill that rose, in the same words as everywhere. */
function SkillRises() {
  const t = useExtracted();
  const stateLabel = useStateLabel();
  const { summary } = useSessionSummary();
  const rises = getRisenSkills(summary.skillsMoved);

  if (rises.length === 0) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-1">
      <PageSectionTitle>{t("Skills that rose")}</PageSectionTitle>

      <StepRows>
        {rises.map((move) => (
          <StepRow className="justify-between" key={move.skillId}>
            <span className="min-w-0 font-medium text-pretty">{move.name}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-xs">
              {t.rich("{from} → <strong>{to}</strong>", {
                from: stateLabel({ state: move.from }),
                strong: renderNewState,
                to: stateLabel({ state: move.to }),
              })}
            </span>
          </StepRow>
        ))}
      </StepRows>
    </section>
  );
}

/** Tomorrow's lesson as the summary's last row, so the day ends knowing what comes next. */
function TomorrowRow() {
  const t = useExtracted();
  const stopped = useIsStopped();
  const { summary } = useSessionSummary();

  if (stopped || !summary.tomorrow) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-1">
      <PageSectionTitle>{t("Tomorrow")}</PageSectionTitle>

      <StepRows>
        <StepRow>
          <BookOpenIcon aria-hidden="true" />
          <span className="min-w-0 flex-1 font-medium text-pretty">{summary.tomorrow.title}</span>
        </StepRow>
      </StepRows>
    </section>
  );
}

/**
 * The day's payoff on one screen, on the page: "Done in 49 min", the day's four numbers, the
 * skills that rose and tomorrow's lesson. Right after "Stop for today", "Done for now" with the
 * minutes so far.
 */
export function DoneStep() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const stopped = useIsStopped();
  const { summary } = useSessionSummary();

  return (
    <StepCard className="items-stretch">
      <StepHeader>
        <StepEyebrow>{t("Today's session")}</StepEyebrow>
        <StepTitle>{stopped ? t("Done for now") : <DoneTitle />}</StepTitle>
        {stopped && summary.minutes >= 1 && (
          <StepDetail className="font-mono text-[0.8125rem] tabular-nums">
            {t("{time} so far", { time: formatDuration(summary.minutes) })}
          </StepDetail>
        )}
      </StepHeader>

      <SessionNumbers />
      <SkillRises />
      <TomorrowRow />
    </StepCard>
  );
}
