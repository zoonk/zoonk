"use client";

import { ArrowRightIcon, CheckIcon, FlagIcon, RotateCcwIcon, SearchCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PageSectionTitle } from "../_components/page";
import { StepRow, StepRows } from "../_components/step-card";
import { useCheckpointScreen } from "./checkpoint-context";
import { phaseNumber, usePhaseLabel } from "./checkpoint-labels";
import { type ResultRows } from "./checkpoint-result";
import { useIsWon, useRetry } from "./use-checkpoint-outcome";

function DetailsSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="flex w-full flex-col gap-1">
      <PageSectionTitle>{title}</PageSectionTitle>
      <StepRows>{children}</StepRows>
    </section>
  );
}

function WonDetails({ rows }: { rows: ResultRows }) {
  const t = useExtracted();
  const phaseLabel = usePhaseLabel();
  const { checkpoint } = useCheckpointScreen();
  const phase = phaseNumber(checkpoint);

  return (
    <>
      {(rows.phaseComplete || rows.badge) && (
        <DetailsSection title={t("Rewards")}>
          {rows.phaseComplete && (
            <StepRow>
              <FlagIcon aria-hidden="true" />
              <span className="font-medium">
                {phase ? t("Phase {phase} complete", { phase }) : t("Phase complete")}
              </span>
            </StepRow>
          )}

          {rows.badge && (
            <StepRow>
              <SearchCheckIcon aria-hidden="true" />
              <span className="font-medium">
                {t({
                  description: "A badge for catching the Trickster's traps.",
                  message: "Trap hunter badge",
                })}
              </span>
            </StepRow>
          )}
        </DetailsSection>
      )}

      {rows.nextPhase && (
        <DetailsSection title={t("Next phase")}>
          <StepRow>
            <ArrowRightIcon aria-hidden="true" />
            <span className="font-medium">{phaseLabel(rows.nextPhase)}</span>
          </StepRow>
        </DetailsSection>
      )}
    </>
  );
}

function NotWonDetails({ rows }: { rows: ResultRows }) {
  const t = useExtracted();
  const phaseLabel = usePhaseLabel();
  const retry = useRetry();

  return (
    <DetailsSection title={t("What's next")}>
      {retry && (
        <StepRow>
          {retry.passed ? <CheckIcon aria-hidden="true" /> : <RotateCcwIcon aria-hidden="true" />}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium">{retry.title}</span>
            <span className="text-muted-foreground text-xs text-pretty">{retry.detail}</span>
          </span>
        </StepRow>
      )}

      {rows.nextPhase && (
        <StepRow>
          <ArrowRightIcon aria-hidden="true" />
          <span className="min-w-0 flex-1 text-pretty">
            {t("The next phase, {phase}, is already open.", { phase: phaseLabel(rows.nextPhase) })}
          </span>
        </StepRow>
      )}
    </DetailsSection>
  );
}

export function CheckpointResultDetails({ rows }: { rows: ResultRows }) {
  const won = useIsWon();

  return won ? <WonDetails rows={rows} /> : <NotWonDetails rows={rows} />;
}
