"use client";

import { cn } from "@zoonk/ui/lib/utils";
import {
  CheckIcon,
  ClockIcon,
  ListChecksIcon,
  PauseIcon,
  ScaleIcon,
  TargetIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { FactChip, FactChips } from "../../_components/fact-chips";
import { Meter } from "../../_components/meter";
import {
  StepCard,
  StepEyebrow,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
  StepTitleLabel,
  StepTitleNumber,
} from "../../_components/step-card";
import { useFormatShare } from "../../_utils/percent";
import { hasShareMoved } from "../../_utils/share-moved";
import { useStateLabel } from "../../_utils/use-state-label";
import { type StudySessionSummary } from "../session-types";
import { getRisenSkills } from "./risen-skills";
import { useIsStopped, useSessionSummary } from "./summary-context";

const PERCENT = 100;

/** The session's numbers as chips: time, questions, how many right, and a net score when scored so. */
function SessionFacts() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { summary } = useSessionSummary();

  return (
    <FactChips className="justify-center">
      {summary.netScore !== null && (
        <FactChip>
          <ScaleIcon aria-hidden="true" />
          {t("Net score {net}", { net: String(summary.netScore) })}
        </FactChip>
      )}
      <FactChip>
        <ClockIcon aria-hidden="true" />
        {/* A day stopped early can be shorter than a minute; "0 min" would read as nothing done. */}
        {summary.minutes > 0
          ? t("{minutes} min", { minutes: String(summary.minutes) })
          : t("Under a minute")}
      </FactChip>
      {summary.questions > 0 && (
        <FactChip>
          <ListChecksIcon aria-hidden="true" />
          {t("{count, plural, one {# question} other {# questions}}", { count: summary.questions })}
        </FactChip>
      )}
      {summary.accuracy !== null && (
        <FactChip>
          <TargetIcon aria-hidden="true" />
          {t("{share} right", { share: formatShare(summary.accuracy) })}
        </FactChip>
      )}
    </FactChips>
  );
}

/** A check that lands for a finished session; a pause for one stopped for today. */
function DoneMark() {
  const stopped = useIsStopped();

  return (
    <span
      className={cn(
        "motion-safe:animate-badge-land flex size-16 items-center justify-center rounded-2xl",
        stopped ? "bg-muted text-foreground" : "bg-success/15 text-success",
      )}
    >
      {stopped ? (
        <PauseIcon aria-hidden="true" className="size-8" />
      ) : (
        <CheckIcon aria-hidden="true" className="size-8" strokeWidth={2.5} />
      )}
    </span>
  );
}

/** "Session complete" with its numbers; right after stopping, "Done for now" with what's done. */
export function DoneStep() {
  const t = useExtracted();
  const stopped = useIsStopped();

  return (
    <StepCard>
      <DoneMark />
      <StepTitle>{stopped ? t("Done for now") : t("Session complete")}</StepTitle>
      <SessionFacts />
    </StepCard>
  );
}

/**
 * Preparation before and after, as one bar with the gain lit: the part that was there in the
 * foreground, today's gain in green.
 */
function PreparationBar({ after, before }: { after: number; before: number }) {
  const low = Math.min(before, after);

  return (
    <Meter className="relative h-2.5 w-full max-w-xs">
      <div
        className="bg-foreground absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${low * PERCENT}%` }}
      />
      {after > before && (
        <div
          className="bg-success motion-safe:animate-energy-charge absolute inset-y-0 origin-left rounded-full"
          style={{ left: `${before * PERCENT}%`, width: `${(after - before) * PERCENT}%` }}
        />
      )}
    </Meter>
  );
}

/** What preparation is called for this goal, under its number. */
function usePreparationLabel(): string {
  const t = useExtracted();
  const { goalKind } = useSessionSummary();

  return goalKind === "exam" ? t("ready for the exam") : t("of the way");
}

/** "29% → 33%": the goal's hero number before and after today, big, with the gain lit. */
function PreparationChange({ after, before }: { after: number; before: number }) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const label = usePreparationLabel();

  return (
    <>
      <StepHeader>
        <StepEyebrow>{t("What changed")}</StepEyebrow>
        <StepTitle className="flex flex-col items-center gap-1">
          <StepTitleNumber>
            <span className="text-muted-foreground">{`${formatShare(before)} → `}</span>
            {formatShare(after)}
          </StepTitleNumber>
          <StepTitleLabel className="text-base">{label}</StepTitleLabel>
        </StepTitle>
      </StepHeader>
      <PreparationBar after={after} before={before} />
    </>
  );
}

/** The state a skill rose to stands out from the one it left. */
function renderNewState(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium">{chunks}</span>;
}

/** "Percentages: Learning → Solid": each skill that rose, in the same words as everywhere. */
function SkillRises({ rises }: { rises: StudySessionSummary["skillsMoved"] }) {
  const t = useExtracted();
  const stateLabel = useStateLabel();

  if (rises.length === 0) {
    return null;
  }

  return (
    <StepRows>
      {rises.map((move) => (
        <StepRow className="justify-between" key={move.skillId}>
          <span className="min-w-0 font-medium">{move.name}</span>
          <span className="text-muted-foreground shrink-0">
            {t.rich("{from} → <strong>{to}</strong>", {
              from: stateLabel({ state: move.from }),
              strong: renderNewState,
              to: stateLabel({ state: move.to }),
            })}
          </span>
        </StepRow>
      ))}
    </StepRows>
  );
}

/** The goal's preparation when the session moved it; a language goal says its level elsewhere. */
export function usePreparationChange(): { after: number; before: number } | null {
  const { goalKind, summary } = useSessionSummary();
  const { after, before } = summary.preparation;

  if (goalKind === "language" || after === null) {
    return null;
  }

  const start = before ?? after;
  return hasShareMoved({ after, before: start }) ? { after, before: start } : null;
}

/**
 * What changed, big: the goal's number before and after, then at most two skills that rose. Only
 * when the session moved either.
 */
export function ChangeStep() {
  const t = useExtracted();
  const { summary } = useSessionSummary();
  const change = usePreparationChange();
  const rises = getRisenSkills(summary.skillsMoved);

  return (
    <StepCard>
      {change ? (
        <PreparationChange after={change.after} before={change.before} />
      ) : (
        <StepTitle>{t("What changed")}</StepTitle>
      )}
      <SkillRises rises={rises} />
    </StepCard>
  );
}
