"use client";

import { ListXIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";

export function NoVerdictStep() {
  const t = useExtracted();

  return (
    <StepCard>
      <ListXIcon aria-hidden="true" className="text-muted-foreground size-6" />

      <StepHeader>
        <StepTitle>{t("The questions were removed")}</StepTitle>
        <StepDetail>
          {t("You hadn't answered any yet, so this challenge isn't scored. Nothing is lost.")}
        </StepDetail>
      </StepHeader>
    </StepCard>
  );
}
