"use client";

import { PlayIcon, SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../../_components/save-error";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding-frame";

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
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject>{subject}</OnboardingSubject>
        <OnboardingTitle>{t("Skip what you already know")}</OnboardingTitle>
        <OnboardingDescription>
          {t("A short test finds the lessons you don't need.")}
        </OnboardingDescription>
      </OnboardingHeading>

      <OnboardingFooter>
        <OnboardingPrimaryButton
          busy={starting}
          disabled={pending}
          icon={<PlayIcon aria-hidden="true" />}
          onClick={onStart}
        >
          {t("Start")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton
          busy={pending}
          disabled={starting}
          icon={<SkipForwardIcon aria-hidden="true" />}
          onClick={onScratch}
          variant="ghost"
        >
          {t("Skip")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

function PlacementOutcome({
  failed = false,
  onContinue,
  pending,
  title,
}: {
  failed?: boolean;
  onContinue: () => void;
  pending: boolean;
  title: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingTitle>{title}</OnboardingTitle>
      </OnboardingHeading>
      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <OnboardingPrimaryButton autoFocus disabled={pending} onClick={onContinue}>
          {t("Continue")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
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
    <PlacementOutcome
      onContinue={onContinue}
      pending={pending}
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
    <PlacementOutcome
      failed={failed}
      onContinue={onContinue}
      pending={pending}
      title={t("We couldn't make a test for this goal")}
    />
  );
}
