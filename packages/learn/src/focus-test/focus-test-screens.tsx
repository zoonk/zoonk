"use client";

import {
  type FocusTestOffer,
  type FocusTestSitting,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { PlayIcon, SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingActions,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding/onboarding-frame";
import { TestOutcome } from "../onboarding/test-outcome";
import { type FocusTestHost } from "./focus-test-result";
import { type Pressed } from "./use-focus-test";
import { useFocusTestTitle, useSeeResultLabel, useTestTime } from "./use-focus-test-texts";

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
  const time = useTestTime();

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions failed={failed}>
          <OnboardingSecondaryButton
            busy={pressed === "other"}
            disabled={pressed === "main"}
            icon={host === "onboarding" ? <SkipForwardIcon aria-hidden="true" /> : undefined}
            onClick={onSkip}
          >
            {host === "onboarding" ? t("Skip for now") : t("Not now")}
          </OnboardingSecondaryButton>
          <OnboardingPrimaryButton
            busy={pressed === "main"}
            disabled={pressed === "other"}
            icon={<PlayIcon aria-hidden="true" />}
            onClick={onStart}
          >
            {t("Start")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
    >
      <OnboardingHeading>
        <OnboardingSubject position={time.whole(next.minutes)}>{t("Focus test")}</OnboardingSubject>
        <OnboardingTitle>{title(suggestsFocus)}</OnboardingTitle>
        <OnboardingDescription>{t("A short test on your exam's subjects.")}</OnboardingDescription>
      </OnboardingHeading>
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
  const time = useTestTime();
  const seeResult = useSeeResultLabel();

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions failed={failed}>
          <OnboardingSecondaryButton busy={pressed === "other"} onClick={onSeeResult}>
            {seeResult}
          </OnboardingSecondaryButton>
          <OnboardingPrimaryButton
            autoFocus
            disabled={pressed === "other"}
            icon={<PlayIcon aria-hidden="true" />}
            onClick={onContinue}
          >
            {t("Continue")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
    >
      <OnboardingHeading>
        <OnboardingSubject position={time.left(sitting.minutes)}>
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
    <TestOutcome
      busy={pending}
      continueLabel={seeResult}
      failed={failed}
      onContinue={onFinish}
      subject={t("Focus test")}
      title={t("Your answers are saved")}
    />
  );
}
