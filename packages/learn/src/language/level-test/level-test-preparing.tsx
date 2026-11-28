"use client";

import { useExtracted } from "next-intl";
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
  leave,
  onSkip,
  run,
  skipping,
}: {
  /** What leaving the wait is called, and the line beside it. */
  leave: { label: string; note: string | null };
  onSkip: () => void;
  run: GenerationRun;
  skipping: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions
          note={leave.note && <OnboardingActionsNote>{leave.note}</OnboardingActionsNote>}
        >
          <OnboardingSecondaryButton busy={skipping} onClick={onSkip}>
            {leave.label}
          </OnboardingSecondaryButton>
        </OnboardingActions>
      }
    >
      <GenerationWait kind="levelTestBank" run={run}>
        <OnboardingHeading>
          <OnboardingTitle>{t("Getting your test ready")}</OnboardingTitle>
          <OnboardingDescription>
            {t({
              description:
                "Shown while the learner waits for their first questions to be prepared. “This” is the wait.",
              message: "This takes a minute or two.",
            })}
          </OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>
    </OnboardingColumn>
  );
}
