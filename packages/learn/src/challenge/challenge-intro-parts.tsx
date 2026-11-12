"use client";

import { useExtracted, useFormatter } from "next-intl";
import { PageEyebrow } from "../_components/page";
import { StepDetail, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { toLabelCase } from "../_utils/label-case";
import { useChallengeScreen } from "./challenge-context";

export function IntroHeading({
  detail,
  eyebrow,
  title,
  when,
}: {
  detail?: string | null;
  eyebrow?: string | null;
  title: string;
  when?: string | null;
}) {
  return (
    <StepHeader>
      {eyebrow && <StepEyebrow>{toLabelCase(eyebrow)}</StepEyebrow>}
      {when && <PageEyebrow>{when}</PageEyebrow>}
      <StepTitle>{title}</StepTitle>
      {detail && <StepDetail>{detail}</StepDetail>}
    </StepHeader>
  );
}

export function useQuestionsFact() {
  const t = useExtracted();
  return (count: number) => t("{count, plural, one {# question} other {# questions}}", { count });
}

export function usePrizeFact(): string {
  const t = useExtracted();
  const format = useFormatter();
  const { challenge } = useChallengeScreen();

  return t("+{points} Brain Power", { points: format.number(challenge.reward.brainPower) });
}

/** A second go says so; a first one needs no label over its title. */
export function useRematchEyebrow(): string | null {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();

  return challenge.rematch ? t("Rematch") : null;
}
