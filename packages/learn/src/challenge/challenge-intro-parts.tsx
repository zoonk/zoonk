"use client";

import { useExtracted, useFormatter } from "next-intl";
import { Eyebrow } from "../_components/eyebrow";
import { StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { useChallengeScreen } from "./challenge-context";

export function IntroHeading({
  detail,
  eyebrow,
  title,
}: {
  detail?: string | null;
  eyebrow?: string | null;
  title: string;
}) {
  return (
    <StepHeader>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
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
