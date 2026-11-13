"use client";

import { useExtracted } from "next-intl";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
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
}: {
  onScratch: () => void;
  onStart: () => void;
  pending: boolean;
  starting: boolean;
  subject: string;
}) {
  const t = useExtracted();

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
        <OnboardingTitle>{t("Skip what you already know")}</OnboardingTitle>
        <OnboardingDescription>
          {t("A short test finds the lessons you don't need.")}
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
