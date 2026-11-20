"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Eyebrow } from "../_components/eyebrow";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { ESSAY_QUOTE_CLASS } from "../essay/essay-labels";

export function NothingLeftComment() {
  const t = useExtracted();

  return (
    <StepCard>
      <StepHeader>
        <Eyebrow>{t("Next step")}</Eyebrow>
        <StepTitle>{t("Nothing left to work on")}</StepTitle>
        <StepDetail>{t("Every criterion has full marks in this estimate.")}</StepDetail>
      </StepHeader>
    </StepCard>
  );
}

/** The one thing to work on: the same card for every rubric's result. */
export function NextStepCard({
  example,
  quote,
  text,
  title,
}: {
  example: string | null | undefined;
  quote: string | null | undefined;
  text: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <StepCard className="items-stretch">
      <StepHeader>
        <Eyebrow>{t("Next step")}</Eyebrow>
        <StepTitle>{title}</StepTitle>
      </StepHeader>

      {quote && (
        <blockquote className={cn(ESSAY_QUOTE_CLASS, "border-warning italic")}>{quote}</blockquote>
      )}
      <p className="text-pretty">{text}</p>
      {example && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("For example: {example}", { example })}
        </p>
      )}
    </StepCard>
  );
}
