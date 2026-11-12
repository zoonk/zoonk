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
  onSkip,
  run,
  skipping,
}: {
  onSkip: () => void;
  run: GenerationRun;
  skipping: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <GenerationWait kind="levelTestBank" run={run}>
        <OnboardingHeading>
          <OnboardingTitle>{t("Getting your level test ready")}</OnboardingTitle>
          <OnboardingDescription>{t("This takes a minute or two.")}</OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>

      <OnboardingFooter>
        <OnboardingSecondaryButton
          busy={skipping}
          icon={<SkipForwardIcon aria-hidden="true" />}
          onClick={onSkip}
        >
          {t("Skip")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
