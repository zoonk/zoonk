"use client";

import { OnboardingFooter, OnboardingPrimaryButton } from "../onboarding-frame";

/** The only way on from a held wait, pinned so it's in reach under a long card. */
export function HeldFooter({
  children,
  onContinue,
}: {
  children: React.ReactNode;
  onContinue: () => void;
}) {
  return (
    <OnboardingFooter className="bg-background sticky bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <OnboardingPrimaryButton onClick={onContinue}>{children}</OnboardingPrimaryButton>
    </OnboardingFooter>
  );
}
