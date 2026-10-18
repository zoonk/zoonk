"use client";

import { useExtracted, useFormatter } from "next-intl";
import { PageEyebrow } from "../_components/page";
import { StepDetail, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { toLabelCase } from "../_utils/label-case";
import { useCheckpointEyebrow } from "../checkpoints/checkpoint-labels";
import { useChallengeScreen } from "./challenge-context";

/**
 * The challenge's name as the page's title, with when or what it is above it and what it asks in
 * one muted line under it. Its facts follow in one mono line, its prize the last of them, then a
 * mock's rule; Start waits in the pinned action bar.
 */
export function IntroHeading({
  detail,
  eyebrow,
  title,
  when,
}: {
  detail?: string | null;
  eyebrow?: string | null;
  title: string;
  /** When it is ("Sun, Nov 8 · 1:30 PM"), as the date line over a title is drawn: mono. */
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

/** "6 questions", the first of a challenge's facts. */
export function useQuestionsFact() {
  const t = useExtracted();
  return (count: number) => t("{count, plural, one {# question} other {# questions}}", { count });
}

/**
 * What winning (or finishing the week's challenge) is worth, the last of its facts: "+300 Brain
 * Power", said before it starts so nothing is a surprise.
 */
export function usePrizeFact(): string {
  const t = useExtracted();
  const format = useFormatter();
  const { challenge } = useChallengeScreen();

  return t("+{points} Brain Power", { points: format.number(challenge.reward.brainPower) });
}

/** "Phase 2 checkpoint", or a new try at it. Its day, before it opens, is the footer's to say. */
export function useEyebrow(): string {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const name = useCheckpointEyebrow(challenge);

  return challenge.rematch ? t("New try · {name}", { name }) : name;
}
