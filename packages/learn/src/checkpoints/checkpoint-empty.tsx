"use client";

import { ListXIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepCard, StepDetail, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { useCheckpointScreen } from "./checkpoint-context";
import { useCheckpointEyebrow } from "./checkpoint-labels";

export function NoVerdictStep() {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const name = useCheckpointEyebrow(checkpoint);

  return (
    <StepCard>
      <ListXIcon aria-hidden="true" className="text-muted-foreground size-6" />

      <StepHeader>
        <StepEyebrow>{name}</StepEyebrow>
        <StepTitle>{t("The questions were removed")}</StepTitle>
        <StepDetail>
          {t("You hadn't answered any yet, so this challenge isn't scored. Nothing is lost.")}
        </StepDetail>
      </StepHeader>
    </StepCard>
  );
}
