"use client";

import { SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLanguageNameInSentence } from "../../_utils/use-language-name";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import {
  OnboardingActions,
  OnboardingActionsNote,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../../onboarding/onboarding-frame";

export function LevelTestPreparing({
  onSkip,
  run,
  skipping,
  targetLanguage,
}: {
  onSkip: () => void;
  run: GenerationRun;
  skipping: boolean;
  targetLanguage: string;
}) {
  const t = useExtracted();
  const language = useLanguageNameInSentence()(targetLanguage);

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions
          note={
            <OnboardingActionsNote>
              {t("Your plan starts from the level you gave, and your first sessions fine-tune it.")}
            </OnboardingActionsNote>
          }
        >
          <OnboardingSecondaryButton
            busy={skipping}
            icon={<SkipForwardIcon aria-hidden="true" />}
            onClick={onSkip}
          >
            {t("Skip the test")}
          </OnboardingSecondaryButton>
        </OnboardingActions>
      }
    >
      <GenerationWait kind="levelTestBank" run={run}>
        <OnboardingHeading>
          <OnboardingTitle>{t("Preparing your level test")}</OnboardingTitle>
          <OnboardingDescription>
            {t(
              "The {language} test is new in your language, so its questions are being written now. It usually takes a minute or two, and only this once.",
              { language },
            )}
          </OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>
    </OnboardingColumn>
  );
}
