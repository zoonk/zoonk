"use client";

import { FORWARD_ICON } from "@zoonk/ui/components/button";
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
          <OnboardingPrimaryButton
            autoFocus
            busy={busy}
            disabled={disabled}
            onClick={onContinue}
            // "Continue" goes to the next screen, so it carries the arrow every Continue has; a label of its own (Done) doesn't.
            {...(continueLabel ? {} : FORWARD_ICON)}
          >
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
