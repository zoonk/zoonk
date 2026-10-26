"use client";

import {
  ArrowRightIcon,
  BrainIcon,
  CheckIcon,
  FlagIcon,
  RotateCcwIcon,
  SearchCheckIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { StepRow, StepRows } from "../_components/step-card";
import { getOwnBrainPower } from "../session/block-brain-power";
import { useCheckpointScreen } from "./checkpoint-context";
import { phaseNumber, usePhaseLabel } from "./checkpoint-labels";
import { useIsWon, useRetry } from "./use-checkpoint-outcome";

/** A block of the result's details: its label, then its flat rows. */
function DetailsSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="flex w-full flex-col gap-1">
      <h2 className="text-label">{title}</h2>
      <StepRows>{children}</StepRows>
    </section>
  );
}

/**
 * The Brain Power the duel added, its value in the mono face and Brain Power's violet on the row's
 * right, as every reward amount reads.
 */
function BrainPowerRow({ points }: { points: number }) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <StepRow>
      <BrainIcon aria-hidden="true" />
      <span className="min-w-0 flex-1 font-medium">{t("Brain Power")}</span>
      <span className="text-brain-text shrink-0 font-mono text-xs font-medium tabular-nums">
        {t("+{points}", { points: format.number(points) })}
      </span>
    </StepRow>
  );
}

/**
 * What a won checkpoint (or a finished weekly one) earned: its Brain Power (what the duel actually
 * earned, answers included, right after it; the day's bonus it paid is the missions' to show),
 * the phase it checks off and the "Trap hunter" badge; then the phase that comes next, by its name.
 */
function WonDetails() {
  const t = useExtracted();
  const phaseLabel = usePhaseLabel();
  const { checkpoint, duel } = useCheckpointScreen();
  const { nextPhase, reward } = checkpoint;
  const phase = phaseNumber(checkpoint);
  const completion = duel.state.completion;
  const points = completion ? getOwnBrainPower(completion) : reward.brainPower;
  const showsNextPhase = nextPhase && reward.phaseComplete && checkpoint.kind !== "weekly";

  return (
    <>
      <DetailsSection title={t("Rewards")}>
        <BrainPowerRow points={points} />

        {reward.phaseComplete && (
          <StepRow>
            <FlagIcon aria-hidden="true" />
            <span className="font-medium">
              {phase ? t("Phase {phase} complete", { phase }) : t("Phase complete")}
            </span>
          </StepRow>
        )}

        {reward.badge && (
          <StepRow>
            <SearchCheckIcon aria-hidden="true" />
            <span className="font-medium">{t("Trap hunter badge")}</span>
          </StepRow>
        )}
      </DetailsSection>

      {showsNextPhase && (
        <DetailsSection title={t("Next phase")}>
          <StepRow>
            <ArrowRightIcon aria-hidden="true" />
            <span className="font-medium">{phaseLabel(nextPhase)}</span>
          </StepRow>
        </DetailsSection>
      )}
    </>
  );
}

/**
 * A duel not won costs nothing, said concretely: a new try after short lessons, the next phase
 * already open, and the Brain Power its right answers still earned.
 */
function NotWonDetails() {
  const t = useExtracted();
  const phaseLabel = usePhaseLabel();
  const { checkpoint, duel } = useCheckpointScreen();
  const retry = useRetry();
  const earned = duel.state.completion ? getOwnBrainPower(duel.state.completion) : 0;
  const showsNextPhase = checkpoint.nextPhase && checkpoint.retry !== "passed";

  return (
    <>
      {(retry || showsNextPhase) && (
        <DetailsSection title={t("What's next")}>
          {retry && (
            <StepRow>
              {retry.passed ? (
                <CheckIcon aria-hidden="true" />
              ) : (
                <RotateCcwIcon aria-hidden="true" />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium">{retry.title}</span>
                <span className="text-muted-foreground text-xs text-pretty">{retry.detail}</span>
              </span>
            </StepRow>
          )}

          {showsNextPhase && checkpoint.nextPhase && (
            <StepRow>
              <ArrowRightIcon aria-hidden="true" />
              <span className="min-w-0 flex-1 text-pretty">
                {t("The next phase, {phase}, is already open.", {
                  phase: phaseLabel(checkpoint.nextPhase),
                })}
              </span>
            </StepRow>
          )}
        </DetailsSection>
      )}

      {earned > 0 && (
        <DetailsSection title={t("Earned")}>
          <BrainPowerRow points={earned} />
        </DetailsSection>
      )}
    </>
  );
}

/**
 * The result beyond its score, as labeled flat rows: what it earned and the next phase after a
 * win, or the new try after a duel not won. A phone shows them under the score; a wide screen,
 * beside it in the aside.
 */
export function CheckpointResultDetails() {
  const won = useIsWon();
  return won ? <WonDetails /> : <NotWonDetails />;
}
