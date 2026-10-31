"use client";

import { useExtracted } from "next-intl";
import { StepCard, StepDetail, StepHeader } from "./step-card";

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
