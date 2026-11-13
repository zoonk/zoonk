"use client";

import {
  type FocusTestOffer,
  type FocusTestSitting,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding/onboarding-frame";
import { FocusTestHowItWorks } from "./focus-test-how-it-works";
import { type FocusTestHost } from "./focus-test-result";
import { type Pressed } from "./use-focus-test";
import { useFocusTestTitle, useSeeResultLabel, useSittingTime } from "./use-focus-test-texts";

export function FocusTestInvitation({
  failed,
  host,
  next,
  onSkip,
  onStart,
  pressed,
  suggestsFocus,
}: {
  failed: boolean;
  host: FocusTestHost;
  next: FocusTestOffer;
  onSkip: () => void;
  onStart: () => void;
  pressed: Pressed;
  suggestsFocus: boolean;
}) {
  const t = useExtracted();
  const title = useFocusTestTitle();
  const { about } = useSittingTime();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject position={about(next.minutes)}>{t("Focus test")}</OnboardingSubject>
        <OnboardingTitle>{title(suggestsFocus)}</OnboardingTitle>
        <OnboardingDescription>
          {suggestsFocus
            ? t({
                description:
                  "Under the headline “Find out where to focus”. Says what the Focus test is, then why it helps: the study plan leaves out lessons on what the learner already knows.",
                message:
                  "Quick questions on your exam's subjects. Your plan skips what you already know, so your time goes where you need it most.",
              })
            : t("Quick questions on your exam's subjects. Your plan skips what you already know.")}
        </OnboardingDescription>
      </OnboardingHeading>

      <FocusTestHowItWorks suggestsFocus={suggestsFocus} />

      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <OnboardingPrimaryButton
          busy={pressed === "main"}
          disabled={pressed === "other"}
          onClick={onStart}
        >
          {t("Start the test")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton
          busy={pressed === "other"}
          disabled={pressed === "main"}
          onClick={onSkip}
        >
          {host === "onboarding" ? t("Skip for now") : t("Not now")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

export function FocusTestResume({
  answered,
  failed,
  onContinue,
  onSeeResult,
  pressed,
  sitting,
}: {
  answered: number;
  failed: boolean;
  onContinue: () => void;
  onSeeResult: () => void;
  pressed: Pressed;
  sitting: FocusTestSitting;
}) {
  const t = useExtracted();
  const { aboutLeft } = useSittingTime();
  const seeResult = useSeeResultLabel();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject position={aboutLeft(sitting.minutes)}>
          {t("Focus test")}
        </OnboardingSubject>
        <OnboardingTitle>{t("Continue your test")}</OnboardingTitle>
        <OnboardingDescription>
          {t({
            description:
              "Shown when the learner comes back to a Focus test they left halfway: the answers they already gave are kept.",
            message:
              "{count, plural, one {Your # answer is saved.} other {Your # answers are saved.}}",
            values: { count: answered },
          })}
        </OnboardingDescription>
      </OnboardingHeading>

      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <OnboardingPrimaryButton autoFocus disabled={pressed === "other"} onClick={onContinue}>
          {t("Continue")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton busy={pressed === "other"} onClick={onSeeResult}>
          {seeResult}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

/** A sitting that's over and not closed yet: the learner came back to it, or closing it failed. */
export function FocusTestEnded({
  failed,
  onFinish,
  pending,
}: {
  failed: boolean;
  onFinish: () => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const seeResult = useSeeResultLabel();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject>{t("Focus test")}</OnboardingSubject>
        <OnboardingTitle>{t("Your answers are saved")}</OnboardingTitle>
      </OnboardingHeading>

      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <OnboardingPrimaryButton autoFocus busy={pending} onClick={onFinish}>
          {seeResult}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
