"use client";

import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, FlagIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { Callout } from "../_components/callout";
import { FactChip, FactChips } from "../_components/fact-chips";
import { KindTile } from "../_components/kind-tile";
import { StepCard, StepDetail, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { Steps, type StepsItem } from "../_components/steps";
import { TaskMainLink } from "../shell/task-frame";
import { useCheckpointScreen } from "./checkpoint-context";
import { usePhaseLabel } from "./checkpoint-labels";
import { CheckpointReviewSheet } from "./checkpoint-review";
import { CheckpointRewardsStep } from "./checkpoint-rewards";

type Outcome = { correct: number; passed: boolean; total: number };

/** How it went: from the moment it finished, or from the saved block when reopened later. */
function useOutcome(): Outcome | null {
  const { checkpoint, duel } = useCheckpointScreen();
  const fresh = duel.state.completion?.checkpoint;

  return fresh
    ? { correct: fresh.correct, passed: fresh.passed, total: fresh.total }
    : checkpoint.result;
}

/** A weekly challenge is done once finished; a phase's Trickster is won or not. */
function useIsWon(): boolean {
  const { checkpoint } = useCheckpointScreen();
  const outcome = useOutcome();

  return checkpoint.kind === "weekly" || Boolean(outcome?.passed);
}

function useHeadline(): string {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const won = useIsWon();

  if (checkpoint.kind === "weekly") {
    return t("Weekly challenge done");
  }

  return won ? t("You beat the Trickster!") : t("Not this time");
}

/** "8 of 10 right"; a duel not won also says how many winning takes. */
function useScoreLine(outcome: Outcome): string {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const won = useIsWon();
  const score = { correct: String(outcome.correct), total: String(outcome.total) };

  if (won) {
    return t("{correct} of {total} right", score);
  }

  return t("{correct} of {total} right. Winning takes {passMark}.", {
    ...score,
    passMark: String(checkpoint.passMark),
  });
}

/** The Trickster as the result's art: beaten, he leans back; otherwise he still holds his sign. */
function ResultArt() {
  const { checkpoint } = useCheckpointScreen();
  const won = useIsWon();

  if (checkpoint.kind === "weekly") {
    return <KindTile kind="challenge" size="lg" />;
  }

  return (
    <Trickster
      className={cn("size-28 sm:size-32", won && "rotate-12 opacity-80")}
      pose={won ? "sly" : "hero"}
    />
  );
}

/** A duel not won still earns Brain Power for its right answers, said beside the score. */
function EarnedChip() {
  const t = useExtracted();
  const format = useFormatter();
  const { duel } = useCheckpointScreen();
  const earned = duel.state.completion?.brainPower ?? 0;

  if (earned <= 0) {
    return null;
  }

  return (
    <FactChips className="justify-center">
      <FactChip>
        <BrainIcon aria-hidden="true" />
        {t("+{points} Brain Power", { points: format.number(earned) })}
      </FactChip>
    </FactChips>
  );
}

/** The result: the Trickster, won or not, and the score. */
function OutcomeStep() {
  const headline = useHeadline();
  const outcome = useOutcome();
  const won = useIsWon();
  const scoreLine = useScoreLine(outcome ?? { correct: 0, passed: false, total: 0 });

  return (
    <StepCard>
      <ResultArt />
      <StepHeader>
        <StepTitle>{headline}</StepTitle>
        {outcome && <StepDetail>{scoreLine}</StepDetail>}
      </StepHeader>
      {!won && <EarnedChip />}
    </StepCard>
  );
}

/** The new try, as things stand now: tomorrow, back in the plan, or passed on a later try. */
function useRetry(): { detail: string; title: string } | null {
  const t = useExtracted();
  const { checkpoint, duel } = useCheckpointScreen();
  const lessons = String(checkpoint.reinforcementLessons);
  // Right after the duel, its new try is tomorrow.
  const retry = duel.state.completion ? "tomorrow" : checkpoint.retry;

  if (retry === "passed") {
    return { detail: t("This phase is complete."), title: t("Passed on a later try") };
  }

  if (!retry) {
    return null;
  }

  return {
    detail: t("After {lessons} short lessons on what tripped you up. Nothing is lost.", {
      lessons,
    }),
    title: retry === "tomorrow" ? t("New try tomorrow") : t("New try in your next session"),
  };
}

/** A duel not won costs nothing: a new try after short lessons, and the next phase is open. */
function RetryStep() {
  const t = useExtracted();
  const phaseLabel = usePhaseLabel();
  const { checkpoint } = useCheckpointScreen();
  const retry = useRetry();

  if (!retry) {
    return null;
  }

  return (
    <>
      <StepCard>
        <KindTile icon={RotateCcwIcon} kind="challenge" size="lg" />
        <StepHeader>
          <StepTitle>{retry.title}</StepTitle>
          <StepDetail>{retry.detail}</StepDetail>
        </StepHeader>
      </StepCard>

      {checkpoint.nextPhase && checkpoint.retry !== "passed" && (
        <Callout>
          <FlagIcon aria-hidden="true" />
          <p>
            {t("The next phase, {phase}, is already open.", {
              phase: phaseLabel(checkpoint.nextPhase),
            })}
          </p>
        </Callout>
      )}
    </>
  );
}

/** After a win, the phase that comes next, by its name. */
function NextPhaseStep() {
  const t = useExtracted();
  const phaseLabel = usePhaseLabel();
  const { checkpoint } = useCheckpointScreen();

  if (!checkpoint.nextPhase) {
    return null;
  }

  return (
    <StepCard>
      <KindTile icon={FlagIcon} kind="lesson" size="lg" />
      <StepHeader>
        <StepEyebrow>{t("Next phase")}</StepEyebrow>
        <StepTitle>{phaseLabel(checkpoint.nextPhase)}</StepTitle>
      </StepHeader>
    </StepCard>
  );
}

/** The result's steps: how it went, then what it earned and what's next, or the new try. */
function useResultItems(): StepsItem[] {
  const { checkpoint } = useCheckpointScreen();
  const won = useIsWon();
  const retry = useRetry();
  const nextAfterWin = won && checkpoint.kind !== "weekly" && checkpoint.reward.phaseComplete;

  return [
    { content: <OutcomeStep />, id: "outcome" },
    won && { content: <CheckpointRewardsStep />, id: "rewards" },
    !won && retry && { content: <RetryStep />, id: "retry" },
    nextAfterWin && checkpoint.nextPhase && { content: <NextPhaseStep />, id: "next" },
  ].filter((item) => item !== null && item !== false);
}

/**
 * The end of a checkpoint, one thing at a time. A win: the Trickster beaten, what it earned and
 * the next phase. A duel not won is kind and concrete: a new try after short lessons, and the next
 * phase already open. The answers and the traps are one text link away.
 */
export function CheckpointResultView() {
  const t = useExtracted();
  const { hrefs } = useCheckpointScreen();
  const items = useResultItems();

  return (
    <Steps
      exitHref={hrefs.exit}
      finalAction={<TaskMainLink href={hrefs.continue}>{t("Continue")}</TaskMainLink>}
      finalOptions={<CheckpointReviewSheet />}
      items={items}
    />
  );
}
