"use client";

import { useExtracted } from "next-intl";
import { useFormatDuration } from "../../_utils/time-format";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding-frame";
import { TestOutcome, TestStartActions } from "../test-outcome";

export function PlacementIntro({
  onScratch,
  onStart,
  pending,
  starting,
  subject,
  testMinutes,
}: {
  onScratch: () => void;
  onStart: () => void;
  pending: boolean;
  starting: boolean;
  subject: string;
  testMinutes: number;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (
    <OnboardingColumn
      bar={
        <TestStartActions
          onScratch={onScratch}
          onStart={onStart}
          pending={pending}
          starting={starting}
        />
      }
    >
      <OnboardingHeading>
        <OnboardingSubject>{subject}</OnboardingSubject>
        <OnboardingTitle>{t("Already know some of this?")}</OnboardingTitle>
        <OnboardingDescription>
          {t("A short test finds the lessons you don't need.")}
        </OnboardingDescription>
        <OnboardingDescription>
          {t("About {time}", { time: formatDuration(testMinutes) })}
        </OnboardingDescription>
      </OnboardingHeading>
    </OnboardingColumn>
  );
}

/** A test that's over and not saved yet: the learner came back to it, or its last save failed. */
export function PlacementDone({
  onContinue,
  pending,
}: {
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return <TestOutcome busy={pending} onContinue={onContinue} title={t("Your answers are saved")} />;
}

export function PlacementUnavailable({
  failed,
  onContinue,
  pending,
}: {
  failed?: boolean;
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <TestOutcome
      busy={pending}
      failed={failed}
      lead={
        <OnboardingDescription>
          {t(
            "There's no test for this goal yet. Your first few days show us what you already know.",
          )}
        </OnboardingDescription>
      }
      onContinue={onContinue}
      title={t("We'll find your level as you study")}
    />
  );
}
