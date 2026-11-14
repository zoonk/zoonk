"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { CountUp } from "@zoonk/ui/components/count-up";
import { cn } from "@zoonk/ui/lib/utils";
import {
  BookOpenIcon,
  BrainIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { PageSectionTitle } from "../../_components/page";
import { StatTile, StatTiles } from "../../_components/stat-tile";
import {
  StepCard,
  StepDetail,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
} from "../../_components/step-card";
import { useFormatProgressShare, useFormatShare } from "../../_utils/percent";
import { useFormatDuration } from "../../_utils/time-format";
import { useBeltName, useBeltStep } from "../../_utils/use-belt-name";
import { ReminderOffer } from "../../reminders/reminder-offer";
import { type StudySessionSummary } from "../session-types";
import { SummaryExtraTime } from "./summary-actions";
import { useIsStopped, useSessionSummary } from "./summary-context";

/** In the title's one face: the mono face's wide space read "Done in 13  min". */
function DoneTitle() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { summary } = useSessionSummary();

  if (summary.minutes < 1) {
    return t("Done in under a minute");
  }

  return t("Done in {time}", { time: formatDuration(summary.minutes) });
}

function useGoalNumber() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const formatProgressShare = useFormatProgressShare();
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
  const format = forExam ? formatShare : formatProgressShare;
  const shown = { after: format(after), before: format(start) };
  const moved = shown.after !== shown.before;

  return {
    change: moved ? shown : null,
    dropped: moved && after < start,
    label: forExam ? t("Preparation") : t("Progress"),
    value: shown.after,
  };
}

function RightAnswersValue({ correct, questions }: { correct: number; questions: number }) {
  const format = useFormatter();

  return (
    <>
      {format.number(correct)}
      <span className="text-muted-foreground">{`/${format.number(questions)}`}</span>
    </>
  );
}

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

function BeltDetail({ belt }: { belt: NonNullable<StudySessionSummary["belt"]> }) {
  const beltName = useBeltName();
  const beltStep = useBeltStep();
  const { color } = belt.after;

  return (
    <span className="inline-flex items-center gap-1.5">
      {/* The label's icon box, so the belt's name starts under the label. */}
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <BeltIndicator color={color} label={beltName(color)} size="sm" />
      </span>
      {beltStep(belt.after)}
    </span>
  );
}

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

      {/* A number that went down says so quietly, never in the color of progress. */}
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

      <StatTile
        className="with-aside:hidden"
        detail={summary.belt && <BeltDetail belt={summary.belt} />}
        icon={<BrainIcon />}
        label={t("Brain Power")}
        tone="brain"
        value={
          <CountUp
            format={(points) => t("+{points}", { points: format.number(points) })}
            value={summary.brainPower}
          />
        }
      />
    </StatTiles>
  );
}

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

export function DoneStep() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const stopped = useIsStopped();
  const { reminderActions, summary } = useSessionSummary();
  // Showing the offer claims it, so a re-read summary comes back without one; it stays for this visit.
  // oxlint-disable-next-line react/hook-use-state -- Read once as the summary opens, never updated.
  const [reminderOffer] = useState(summary.reminderOffer);

  return (
    <StepCard className="items-stretch">
      <StepHeader>
        <StepTitle>{stopped ? t("Done for now") : <DoneTitle />}</StepTitle>
        {stopped && summary.minutes >= 1 && (
          <StepDetail className="text-compact font-mono tabular-nums">
            {t("{time} today", { time: formatDuration(summary.minutes) })}
          </StepDetail>
        )}
      </StepHeader>

      <SessionNumbers />
      <TomorrowRow />
      <SummaryExtraTime />
      <ReminderOffer actions={reminderActions} offer={reminderOffer} />
    </StepCard>
  );
}
