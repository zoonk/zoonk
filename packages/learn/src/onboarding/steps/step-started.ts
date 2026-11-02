import { tabStorage } from "../../_utils/device-storage";

type StartedStep = "levelTest" | "placement";

const KEY_PREFIX = "zoonk:onboarding-started:";

function getKey({ goalId, step }: { goalId: string; step: StartedStep }): string {
  return `${KEY_PREFIX}${step}:${goalId}`;
}

export function rememberStepStart(input: { goalId: string; step: StartedStep }) {
  tabStorage.set(getKey(input), "1");
}

export function wasStepStarted(input: { goalId: string; step: StartedStep }): boolean {
  return tabStorage.get(getKey(input)) === "1";
}
