"use client";

import {
  LEVEL_TEST_MINUTES,
  type LanguageLevelTestView,
} from "@zoonk/core/language/level-test/contract";
import { getLanguageNameInSentence } from "@zoonk/utils/languages";
import { isValidLocale } from "@zoonk/utils/locale";
import { PlayIcon, SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../../_components/save-error";
import { useAppLocale } from "../../_utils/locale";
import { useFormatDuration } from "../../_utils/time-format";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../../onboarding/onboarding-frame";
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
  const locale = useAppLocale();

  if (language === locale || !isValidLocale(language)) {
    return null;
  }

  return (
    <OnboardingSecondaryButton lang={language} onClick={() => onSwitch(language)} variant="ghost">
      {t("Use the app in {language}", {
        language: getLanguageNameInSentence({ targetLanguage: language, userLanguage: language }),
      })}
    </OnboardingSecondaryButton>
  );
}

export function TestIntro({
  goal,
  onScratch,
  onStart,
  onSwitch,
  pending,
  showAlphabetNote,
  starting,
}: {
  goal: { language: string; targetLanguage: string };
  onScratch: () => void;
  onStart: () => void;
  onSwitch: (language: string) => void;
  pending: boolean;
  showAlphabetNote: boolean;
  starting: boolean;
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const formatDuration = useFormatDuration();

  const target = getLanguageNameInSentence({
    targetLanguage: goal.targetLanguage,
    userLanguage: locale,
  });

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingTitle>
          {t("Find your level in {language}", { language: target })}
        </OnboardingTitle>
        <OnboardingDescription>
          {t(
            "About {time} of reading, listening and one sentence out loud, so your plan starts at your level.",
            { time: formatDuration(LEVEL_TEST_MINUTES) },
          )}
        </OnboardingDescription>
      </OnboardingHeading>

      {showAlphabetNote && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("New to its alphabet? Skip the test. Your first lesson teaches you to read it.")}
        </p>
      )}

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
          {t("Skip")}
        </OnboardingSecondaryButton>
        <InterfaceOffer language={goal.language} onSwitch={onSwitch} />
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

export function TestDone({
  failed,
  levels,
  onContinue,
  pending,
}: {
  failed: boolean;
  levels: ReadyTest["levels"];
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject>{t("Level test")}</OnboardingSubject>
        <OnboardingTitle>{t("Your level")}</OnboardingTitle>
      </OnboardingHeading>
      <LevelBars levels={levels} />
      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <OnboardingPrimaryButton autoFocus disabled={pending} onClick={onContinue}>
          {t("Continue")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
