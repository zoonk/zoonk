"use client";

import {
  LEVEL_TEST_MINUTES,
  type LanguageLevelTestView,
} from "@zoonk/core/language/level-test/contract";
import { usesNonLatinScript } from "@zoonk/utils/languages";
import { isValidLocale } from "@zoonk/utils/locale";
import { CircleCheckIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useFormatDuration } from "../../_utils/time-format";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../../onboarding/onboarding-frame";
import { StepIcon } from "../../onboarding/steps/step-parts";
import { LevelBars } from "./level-test-parts";

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;

function InterfaceOffer({
  language,
  onSwitch,
}: {
  language: string;
  onSwitch: (language: string) => void;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const name = new Intl.DisplayNames([language], { type: "language" }).of(language) ?? language;

  if (language === locale || !isValidLocale(language)) {
    return null;
  }

  return (
    <OnboardingSecondaryButton lang={language} onClick={() => onSwitch(language)} variant="ghost">
      {t("Use the app in {language}", { language: name })}
    </OnboardingSecondaryButton>
  );
}

export function TestIntro({
  goal,
  onScratch,
  onStart,
  onSwitch,
  pending,
}: {
  goal: { language: string; targetLanguage: string };
  onScratch: () => void;
  onStart: () => void;
  onSwitch: (language: string) => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const formatDuration = useFormatDuration();
  const target = new Intl.DisplayNames([locale], { type: "language" }).of(goal.targetLanguage);

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingTitle>
          {t("Let's see your level in {language}", { language: target ?? goal.targetLanguage })}
        </OnboardingTitle>
        <OnboardingDescription>
          {t(
            "About {time} of reading, listening and one sentence out loud, so your plan starts at your level.",
            { time: formatDuration(LEVEL_TEST_MINUTES) },
          )}
        </OnboardingDescription>
      </OnboardingHeading>

      {usesNonLatinScript(goal.targetLanguage) && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t(
            "New to its alphabet? Skip the test. Your first session starts with a short lesson on reading it.",
          )}
        </p>
      )}

      <OnboardingFooter>
        <OnboardingPrimaryButton disabled={pending} onClick={onStart}>
          {t("Start")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton disabled={pending} onClick={onScratch} variant="ghost">
          {t("Skip the test")}
        </OnboardingSecondaryButton>
        <InterfaceOffer language={goal.language} onSwitch={onSwitch} />
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

export function TestDone({
  levels,
  onContinue,
  pending,
}: {
  levels: ReadyTest["levels"];
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <StepIcon success>
        <CircleCheckIcon />
      </StepIcon>
      <OnboardingHeading>
        <OnboardingTitle>{t("Your level today")}</OnboardingTitle>
        <OnboardingDescription>
          {t("Based on the test. It gets more accurate every week.")}
        </OnboardingDescription>
      </OnboardingHeading>
      <LevelBars levels={levels} />
      <OnboardingFooter>
        <OnboardingPrimaryButton autoFocus disabled={pending} onClick={onContinue}>
          {t("Build my plan")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
