"use client";

import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "./onboarding-frame";

/** The end of a test (the short test, the level test, the Focus test): what it found and the way on. */
export function TestOutcome({
  busy = false,
  children,
  continueLabel,
  disabled = false,
  failed = false,
  lead,
  note,
  onContinue,
  other,
  rail,
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
  note?: ReactNode;
  onContinue: () => void;
  /** A second action, beside the main one. */
  other?: ReactNode;
  rail?: ReactNode;
  subject?: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn
      rail={rail}
      bar={
        <OnboardingActions failed={failed} note={note}>
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
