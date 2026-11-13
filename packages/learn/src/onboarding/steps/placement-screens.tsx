"use client";

import { PlayIcon, SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SuccessEyebrow } from "../../_components/eyebrow";
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
        <OnboardingTitle>{t("Let's see what you already know")}</OnboardingTitle>
        <OnboardingDescription>
          {t(
            "A few quick questions, so your plan skips what you already know. There's no score, and “I don't know yet” is a fine answer.",
          )}
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
          {t("Skip and start from the basics")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

function PlacementOutcome({
  action,
  children,
  done,
  failed = false,
  onContinue,
  pending,
}: {
  /** Names the next screen when it isn't the plan. */
  action?: string;
  children: React.ReactNode;
  done?: string;
  failed?: boolean;
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        {done && <SuccessEyebrow>{done}</SuccessEyebrow>}
        {children}
      </OnboardingHeading>
      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <OnboardingPrimaryButton autoFocus busy={pending} onClick={onContinue}>
          {action ?? t("See my plan")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

export function PlacementDone({
  answered,
  forToday,
  onContinue,
  pending,
}: {
  answered: number;
  forToday: boolean;
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <PlacementOutcome
      done={t(
        "{count, plural, =0 {# questions answered} one {# question answered} other {# questions answered}}",
        { count: answered },
      )}
      onContinue={onContinue}
      pending={pending}
    >
      <OnboardingTitle>
        {forToday ? t("That's enough questions for today") : t("Your starting point is set")}
      </OnboardingTitle>
      <OnboardingDescription>
        {forToday
          ? t("Your first sessions ask a few more to fine-tune your plan.")
          : t({
              description: '"It" is the learner\'s starting point, named in the title.',
              message: "It gets more accurate every day.",
            })}
      </OnboardingDescription>
    </PlacementOutcome>
  );
}

export function PlacementUnavailable({
  action,
  failed,
  onContinue,
  pending,
}: {
  action?: string;
  failed?: boolean;
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <PlacementOutcome action={action} failed={failed} onContinue={onContinue} pending={pending}>
      <OnboardingTitle>{t("Let's skip the questions")}</OnboardingTitle>
      <OnboardingDescription>
        {t(
          "We couldn't prepare questions for this goal. Your first sessions will find your starting point instead.",
        )}
      </OnboardingDescription>
    </PlacementOutcome>
  );
}
