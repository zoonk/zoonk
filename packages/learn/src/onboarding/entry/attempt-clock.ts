import { type TrackEvent } from "@zoonk/core/analytics/events";

export type OnboardingAttempt = { id: string; submittedAt: number; track: TrackEvent };

export function startOnboardingAttempt({
  hasAttachment,
  track,
}: {
  hasAttachment: boolean;
  track: TrackEvent;
}): OnboardingAttempt {
  const attempt = { id: crypto.randomUUID(), submittedAt: Date.now(), track };

  track({
    name: "Goal Typed",
    properties: {
      attempt_id: attempt.id,
      has_attachment: hasAttachment,
      submitted_at: attempt.submittedAt,
    },
  });

  return attempt;
}

export function linkOnboardingAttempt({
  attempt,
  draftId,
}: {
  attempt: OnboardingAttempt;
  draftId: string;
}): void {
  attempt.track({
    name: "Onboarding Progressed",
    properties: {
      at: Date.now(),
      attempt_id: attempt.id,
      goal_id: null,
      onboarding_id: draftId,
      stage: "attempt_linked",
    },
  });
}
