"use client";

import { useExtracted } from "next-intl";
import { StepCard, StepDetail, StepHeader } from "./step-card";

/**
 * A task opened again with nothing left to answer (every answer is in, or nothing is left to
 * show): finishing it records the result and can start work like the learner's memory, so it waits
 * for Finish in the host's action bar. It says where the learner is and what Finish shows, the same
 * in a lesson and in a session's question block. The task's header names it, so this is a step's
 * heading, not the page's.
 */
export function FinishReady() {
  const t = useExtracted();

  return (
    <StepCard>
      <StepHeader>
        <h2 className="text-title text-balance">{t("Nothing left to answer")}</h2>
        <StepDetail>{t("Finish to see how it went.")}</StepDetail>
      </StepHeader>
    </StepCard>
  );
}
