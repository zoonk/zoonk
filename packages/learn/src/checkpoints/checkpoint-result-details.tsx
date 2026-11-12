"use client";

import { ArrowRightIcon, CheckIcon, RotateCcwIcon, SearchCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PageSectionTitle } from "../_components/page";
import { StepRow, StepRows } from "../_components/step-card";
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

function WonDetails() {
  const t = useExtracted();

  return (
    <DetailsSection title={t("Rewards")}>
      <StepRow>
        <SearchCheckIcon aria-hidden="true" />
        <span className="font-medium">
          {t({
            description: "A badge for catching the Trickster's traps.",
            message: "Trap hunter badge",
          })}
        </span>
      </StepRow>
    </DetailsSection>
  );
}

function NotWonDetails({ rows }: { rows: ResultRows }) {
  const t = useExtracted();
  const retry = useRetry();

  return (
    <DetailsSection title={t("What's next")}>
      {retry && (
        <StepRow>
          {retry.passed ? <CheckIcon aria-hidden="true" /> : <RotateCcwIcon aria-hidden="true" />}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium">{retry.title}</span>
            {retry.detail && (
              <span className="text-muted-foreground text-xs text-pretty">{retry.detail}</span>
            )}
          </span>
        </StepRow>
      )}

      {rows.nextLessonsOpen && (
        <StepRow>
          <ArrowRightIcon aria-hidden="true" />
          <span className="min-w-0 flex-1 text-pretty">
            {t("Your next lessons are already open.")}
          </span>
        </StepRow>
      )}
    </DetailsSection>
  );
}

/** Shown only when `hasResultRows`, so a win reaches here with its badge. */
export function CheckpointResultDetails({ rows }: { rows: ResultRows }) {
  const won = useIsWon();

  return won ? <WonDetails /> : <NotWonDetails rows={rows} />;
}
