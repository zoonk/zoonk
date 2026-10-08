/**
 * Whether the learner tapped to begin placement or the level test for this goal in this tab, so a
 * refresh while waiting for its first questions comes back to the wait instead of its start.
 * Storage can be unavailable (private windows, blocked storage); then a refresh shows the start.
 */
type StartedStep = "levelTest" | "placement";

const KEY_PREFIX = "zoonk:onboarding-started:";

function getKey({ goalId, step }: { goalId: string; step: StartedStep }): string {
  return `${KEY_PREFIX}${step}:${goalId}`;
}

export function rememberStepStart(input: { goalId: string; step: StartedStep }) {
  try {
    sessionStorage.setItem(getKey(input), "1");
  } catch {
    // Nothing to keep: the step's start shows again after a refresh.
  }
}

export function wasStepStarted(input: { goalId: string; step: StartedStep }): boolean {
  try {
    return sessionStorage.getItem(getKey(input)) === "1";
  } catch {
    return false;
  }
}
