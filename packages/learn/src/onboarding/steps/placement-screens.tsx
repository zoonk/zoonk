"use client";

import { PlayIcon, SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding-frame";
import { TestOutcome } from "../test-outcome";

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
        <OnboardingActions>
          <OnboardingSecondaryButton
            busy={pending}
            disabled={starting}
            icon={<SkipForwardIcon aria-hidden="true" />}
            onClick={onScratch}
          >
            {t("Skip")}
          </OnboardingSecondaryButton>
          <OnboardingPrimaryButton
            busy={starting}
            disabled={pending}
            icon={<PlayIcon aria-hidden="true" />}
            onClick={onStart}
          >
            {t("Start")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
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

export function PlacementDone({
  onContinue,
  pending,
}: {
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <TestOutcome
      busy={pending}
      onContinue={onContinue}
      title={t("Your plan skips what you already know")}
    />
  );
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
      onContinue={onContinue}
      title={t("We couldn't make a test for this goal")}
    />
  );
}
