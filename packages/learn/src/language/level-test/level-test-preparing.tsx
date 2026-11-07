"use client";

import { SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../../onboarding/onboarding-frame";

export function LevelTestPreparing({
  language,
  onSkip,
  run,
  skipping,
}: {
  language: string;
  onSkip: () => void;
  run: GenerationRun;
  skipping: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
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

      <OnboardingFooter>
        <OnboardingSecondaryButton
          busy={skipping}
          icon={<SkipForwardIcon aria-hidden="true" />}
          onClick={onSkip}
        >
          {t("Skip the test")}
        </OnboardingSecondaryButton>
        <p className="text-muted-foreground text-center text-sm text-pretty">
          {t("Your plan starts from the level you gave, and your first sessions fine-tune it.")}
        </p>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
