"use client";

import { useExtracted } from "next-intl";
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

export function StepForm({
  canContinue = true,
  children,
  continueLabel,
  description,
  onContinue,
  onSkip,
  pending,
  rail,
  skipLabel,
  subject,
  title,
}: {
  canContinue?: boolean;
  children?: React.ReactNode;
  continueLabel?: string;
  description?: React.ReactNode;
  onContinue: () => void;
  onSkip?: () => void;
  pending: boolean;
  rail?: React.ReactNode;
  skipLabel?: string;
  subject?: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn rail={rail}>
      <form
        className="flex flex-1 flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();

          if (canContinue && !pending) {
            onContinue();
          }
        }}
      >
        <OnboardingHeading>
          {subject && <OnboardingSubject>{subject}</OnboardingSubject>}
          <OnboardingTitle>{title}</OnboardingTitle>
          {description && <OnboardingDescription>{description}</OnboardingDescription>}
        </OnboardingHeading>

        {children}

        <OnboardingFooter>
          <OnboardingPrimaryButton disabled={!canContinue || pending} type="submit">
            {continueLabel ?? t("Continue")}
          </OnboardingPrimaryButton>

          {onSkip && (
            <OnboardingSecondaryButton disabled={pending} onClick={onSkip} type="button">
              {skipLabel ?? t("Skip")}
            </OnboardingSecondaryButton>
          )}
        </OnboardingFooter>
      </form>
    </OnboardingColumn>
  );
}
