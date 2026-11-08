import { trackOnboardingProgress } from "@zoonk/core/analytics/track-onboarding-progress";
import { checkWarmUp } from "@zoonk/core/library/warm-ups/check";
import { claimWarmUp, failWarmUp, readWarmUpStatus } from "@zoonk/core/library/warm-ups/claim";
import { saveWarmUp } from "@zoonk/core/library/warm-ups/save";
import { writeWarmUp } from "@zoonk/core/library/warm-ups/write";

export async function claimWarmUpStep(input: Parameters<typeof claimWarmUp>[0]) {
  "use step";

  const claim = await claimWarmUp(input);

  if (claim.status !== "none") {
    trackOnboardingProgress({
      at: Date.now(),
      cache: claim.status === "claimed" ? "cold" : "warm",
      deck_id: claim.id,
      goalId: input.goalId,
      platform: null,
      stage: "deck_claimed",
    });
  }

  return claim;
}

export async function writeWarmUpStep(input: Parameters<typeof writeWarmUp>[0]) {
  "use step";

  return writeWarmUp(input);
}

export async function checkWarmUpStep(input: Parameters<typeof checkWarmUp>[0]) {
  "use step";

  return checkWarmUp(input);
}

export async function saveWarmUpStep(input: Parameters<typeof saveWarmUp>[0]) {
  "use step";

  return saveWarmUp(input);
}

export async function readWarmUpStatusStep(input: Parameters<typeof readWarmUpStatus>[0]) {
  "use step";

  return readWarmUpStatus(input);
}

export async function failWarmUpStep(input: Parameters<typeof failWarmUp>[0]) {
  "use step";

  return failWarmUp(input);
}
