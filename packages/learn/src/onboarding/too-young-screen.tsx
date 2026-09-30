"use client";

import { type ExperienceMode } from "../experience-mode";
import { ModeProvider } from "../mode-provider";
import { OnboardingFrame } from "./onboarding-frame";
import { TooYoung } from "./steps/age-step";

/**
 * What someone under 13 sees after giving their age, once their account is gone: the same kind
 * goodbye, as its own page, in the look they had on this device.
 */
export function TooYoungScreen({ mode }: { mode: ExperienceMode }) {
  return (
    <ModeProvider experienceMode={mode}>
      <OnboardingFrame>
        <TooYoung />
      </OnboardingFrame>
    </ModeProvider>
  );
}
