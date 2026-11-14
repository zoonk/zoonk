"use client";

import { SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "./onboarding-frame";

/** A test's start: Skip, which plans from what the learner said, then Start. */
export function TestStartActions({
  onScratch,
  onStart,
  pending,
  starting,
}: {
  onScratch: () => void;
  onStart: () => void;
  pending: boolean;
  starting: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingActions>
      <OnboardingSecondaryButton
        busy={pending}
        disabled={starting}
        icon={<SkipForwardIcon aria-hidden="true" />}
        onClick={onScratch}
      >
        {t("Skip")}
      </OnboardingSecondaryButton>
      <OnboardingPrimaryButton busy={starting} disabled={pending} onClick={onStart}>
        {t("Start")}
      </OnboardingPrimaryButton>
    </OnboardingActions>
  );
}

/** The end of a test (the short test, the level test, the Focus test): what it found and the way on. */
export function TestOutcome({
  busy = false,
  children,
  continueLabel,
  disabled = false,
  failed = false,
  lead,
  onContinue,
  other,
  subject,
  title,
}: {
  busy?: boolean;
  /** What the test found, under the heading. */
  children?: ReactNode;
  continueLabel?: string;
  disabled?: boolean;
  failed?: boolean;
  /** Under the title, inside the heading. */
  lead?: ReactNode;
  onContinue: () => void;
  /** A second action, beside the main one. */
  other?: ReactNode;
  subject?: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions failed={failed}>
          {other}
          <OnboardingPrimaryButton autoFocus busy={busy} disabled={disabled} onClick={onContinue}>
            {continueLabel ?? t("Continue")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
    >
      <OnboardingHeading>
        {subject && <OnboardingSubject>{subject}</OnboardingSubject>}
        <OnboardingTitle>{title}</OnboardingTitle>
        {lead}
      </OnboardingHeading>

      {children}
    </OnboardingColumn>
  );
}
