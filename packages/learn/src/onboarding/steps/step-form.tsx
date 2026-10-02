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

/**
 * One onboarding question on its own screen. It's a form, so Enter continues; skippable
 * questions offer a quiet second action that saves nothing.
 */
export function StepForm({
  canContinue = true,
  children,
  continueLabel,
  description,
  onContinue,
  onSkip,
  pending,
  skipLabel,
  subject,
  title,
}: {
  canContinue?: boolean;
  children: React.ReactNode;
  continueLabel?: string;
  description?: string;
  onContinue: () => void;
  onSkip?: () => void;
  pending: boolean;
  skipLabel?: string;
  /** What the question is about, above it: the exam, the course or the subject. */
  subject?: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
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
