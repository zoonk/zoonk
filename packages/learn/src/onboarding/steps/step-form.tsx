"use client";

import { useExtracted } from "next-intl";
import {
  OnboardingAnswer,
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
 * One onboarding question on its own screen, its answer beside it from a wide page. The answer is
 * a form, so Enter continues; skippable questions offer a quiet second action that saves nothing.
 */
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
  /** What the page's aside shows beside this question from 72rem, in place of the flow's rail. */
  rail?: React.ReactNode;
  skipLabel?: string;
  /** What the question is about, above it: the exam, the course or the subject. */
  subject?: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn rail={rail}>
      <OnboardingHeading>
        {subject && <OnboardingSubject>{subject}</OnboardingSubject>}
        <OnboardingTitle>{title}</OnboardingTitle>
        {description && <OnboardingDescription>{description}</OnboardingDescription>}
      </OnboardingHeading>

      <OnboardingAnswer>
        <form
          className="flex flex-1 flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();

            if (canContinue && !pending) {
              onContinue();
            }
          }}
        >
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
      </OnboardingAnswer>
    </OnboardingColumn>
  );
}
