"use client";

import { useExtracted, useFormatter } from "next-intl";
import { PageEyebrow } from "../_components/page";
import { StepDetail, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { toLabelCase } from "../_utils/label-case";
import { useCheckpointEyebrow } from "../checkpoints/checkpoint-labels";
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

export function useEyebrow(): string {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const name = useCheckpointEyebrow(challenge);

  return challenge.rematch ? t("New try · {name}", { name }) : name;
}
