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
  fromPlan = false,
  onSkip,
  run,
  skipping,
  targetLanguage,
}: {
  /** Taken from the plan, which already starts at a level: leaving just goes back to it. */
  fromPlan?: boolean;
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
            !fromPlan && (
              <OnboardingActionsNote>
                {t("Your plan starts from the level you gave, and your first days fine-tune it.")}
              </OnboardingActionsNote>
            )
          }
        >
          <OnboardingSecondaryButton
            busy={skipping}
            icon={fromPlan ? undefined : <SkipForwardIcon aria-hidden="true" />}
            onClick={onSkip}
          >
            {fromPlan ? t("Not now") : t("Skip the test")}
          </OnboardingSecondaryButton>
        </OnboardingActions>
      }
    >
      <GenerationWait kind="levelTestBank" run={run}>
        <OnboardingHeading>
          <OnboardingTitle>{t("Preparing your level test")}</OnboardingTitle>
          <OnboardingDescription>
            {t("Getting the {language} test ready takes a minute or two, and only this once.", {
              language,
            })}
          </OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>
    </OnboardingColumn>
  );
}
