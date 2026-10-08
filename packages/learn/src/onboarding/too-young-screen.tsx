"use client";

import { OnboardingFrame } from "./onboarding-frame";
import { TooYoung } from "./steps/age-step";

/**
 * What someone under 13 sees after giving their age, once their account is gone: the same kind
 * goodbye, as its own page.
 */
export function TooYoungScreen() {
  return (
    <OnboardingFrame>
      <TooYoung />
    </OnboardingFrame>
  );
}
